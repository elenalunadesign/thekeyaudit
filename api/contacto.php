<?php
/*
 * contacto.php · TheKeyAudit
 * Recibe el formulario, verifica reCAPTCHA v3 con Google y reenvía el mensaje a FormSubmit.
 *
 * La clave secreta NO vive en el repositorio. Crea el archivo tka-config.php FUERA de public_html
 * (en Hostinger: domains/thekeyaudit.com/tka-config.php), con este contenido:
 *
 *   <?php return [
 *     'recaptcha_secret' => 'TU_SECRET_KEY',
 *     'formsubmit'       => 'https://formsubmit.co/ajax/contacto@thekeyaudit.com',
 *     'min_score'        => 0.5,
 *   ];
 *
 * Respuesta JSON: { "success": true } o { "success": false, "code": "...", "message": "..." }
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const ALLOWED_HOSTS = ['thekeyaudit.com', 'www.thekeyaudit.com', 'localhost', '127.0.0.1'];
const FIELDS = ['nombre', 'empresa', 'celular', 'email', 'industria', 'necesidad', 'reto', 'idioma'];

function out($ok, $code = '', $message = '', $status = 200)
{
    http_response_code($status);
    echo json_encode($ok ? ['success' => true] : ['success' => false, 'code' => $code, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function post_json($url, array $data, array $headers = [], $timeout = 20)
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($data),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => array_merge(['Accept: application/json'], $headers),
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, $body === false ? null : json_decode($body, true)];
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    out(false, 'METHOD_NOT_ALLOWED', 'Usa POST.', 405);
}

// Solo acepta envíos desde el propio sitio
$origin = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
if (!in_array($originHost, ALLOWED_HOSTS, true)) {
    out(false, 'FORBIDDEN_ORIGIN', 'Origen no permitido.', 403);
}

// Configuración privada (fuera de public_html)
$cfgFile = dirname(__DIR__, 2) . '/tka-config.php';
$cfg = is_file($cfgFile) ? include $cfgFile : [];
$secret = $cfg['recaptcha_secret'] ?? getenv('TKA_RECAPTCHA_SECRET');
$formsubmit = $cfg['formsubmit'] ?? 'https://formsubmit.co/ajax/contacto@thekeyaudit.com';
$minScore = (float) ($cfg['min_score'] ?? 0.5);
if (!$secret || !function_exists('curl_init')) {
    out(false, 'SERVER_NOT_CONFIGURED', 'Falta la configuración de reCAPTCHA en el servidor.', 500);
}

// Campo trampa: los bots lo llenan; se responde éxito sin enviar nada
if (trim((string) ($_POST['_honey'] ?? '')) !== '') {
    out(true);
}

// Límite simple por IP: 5 envíos cada 10 minutos
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rlFile = sys_get_temp_dir() . '/tka-rl-' . sha1($ip);
$now = time();
$hits = array_filter((array) json_decode((string) @file_get_contents($rlFile), true), function ($t) use ($now) {
    return is_int($t) && $t > $now - 600;
});
if (count($hits) >= 5) {
    out(false, 'RATE_LIMIT', 'Demasiados envíos seguidos.', 429);
}

// Verificación de reCAPTCHA v3
$token = (string) ($_POST['g-recaptcha-response'] ?? '');
if ($token === '') {
    out(false, 'CAPTCHA_FAILED', 'Falta el token de reCAPTCHA.', 400);
}
[$st, $v] = post_json('https://www.google.com/recaptcha/api/siteverify', [
    'secret' => $secret,
    'response' => $token,
    'remoteip' => $ip,
]);
if (!is_array($v) || empty($v['success'])) {
    out(false, 'CAPTCHA_FAILED', 'reCAPTCHA no validó el envío.', 400);
}
if (($v['action'] ?? '') !== 'contacto' || !in_array(strtolower($v['hostname'] ?? ''), ALLOWED_HOSTS, true)) {
    out(false, 'CAPTCHA_FAILED', 'reCAPTCHA no corresponde a este formulario.', 400);
}
if ((float) ($v['score'] ?? 0) < $minScore) {
    out(false, 'CAPTCHA_LOW_SCORE', 'reCAPTCHA marcó el envío como sospechoso.', 400);
}

// Validación básica
$data = [];
foreach (FIELDS as $f) {
    $data[$f] = mb_substr(trim((string) ($_POST[$f] ?? '')), 0, $f === 'reto' ? 4000 : 200);
}
$missing = [];
if ($data['nombre'] === '') $missing[] = 'nombre';
if ($data['celular'] === '') $missing[] = 'celular';
if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) $missing[] = 'correo';
if ($missing) {
    out(false, 'VALIDATION', implode(', ', $missing), 400);
}

$hits[] = $now;
@file_put_contents($rlFile, json_encode(array_values($hits)), LOCK_EX);

// Reenvío a FormSubmit
$data['_subject'] = mb_substr((string) ($_POST['_subject'] ?? 'Nueva solicitud · TheKeyAudit'), 0, 150);
$data['_template'] = 'table';
$data['_captcha'] = 'false';
$data['reCAPTCHA'] = number_format((float) $v['score'], 1);
[$st, $r] = post_json($formsubmit, $data, [
    'Referer: https://thekeyaudit.com/',
    'Origin: https://thekeyaudit.com',
], 100);

if (is_array($r) && (($r['success'] ?? '') === true || ($r['success'] ?? '') === 'true')) {
    out(true);
}
$msg = is_array($r) ? (string) ($r['message'] ?? '') : '';
if (stripos($msg, 'activat') !== false) {
    out(false, 'FORM_NOT_ACTIVATED', $msg, 502);
}
out(false, 'FORWARD_FAILED', $msg !== '' ? $msg : 'FormSubmit respondió HTTP ' . $st, 502);
