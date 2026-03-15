<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../includes/config.php';
$db = getDbConnection();
$result = $db->query("SHOW TABLES");
$tables = [];
while ($row = $result->fetch_row()) {
    $tables[] = $row[0];
}
echo json_encode($tables);
