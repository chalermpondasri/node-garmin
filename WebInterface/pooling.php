<?php

$connectionString = "host=localhost user=postgres password=password port=5432 dbname=xsense";
$connection = pg_connect($connectionString) or die('cannot connec to database');
$imei = filter_input(INPUT_POST, 'IMEI');
$cmd = filter_input(INPUT_POST, 'CMD');
//$data = urldecode(filter_input(INPUT_POST, 'DATA'));
$data = filter_input(INPUT_POST, 'DATA');
$sql = '';
switch ($cmd) {
    case 'CHECKALLPOINTS':
        $sql = "SELECT sid FROM \"Stoppoints\" WHERE \"s_IMEI\"= '" . $imei . "' ORDER BY sid ASC ;";
        $result0 = pg_query($connection, $sql);
        $stopIDs = '';
        while ($row = pg_fetch_array($result0)) {
            $stopIDs .= $row["sid"] . ',';
        }
        $IDs = substr($stopIDs, 0, -1);
        pg_free_result($result0);

        $sql = "SELECT count(*) FROM \"Pool\" WHERE \"pool_IMEI\"='" . $imei . "'";
        $result = pg_query($connection, $sql);
        $array = pg_fetch_array($result);
        pg_free_result($result);
        if ($array[0] == 0) {
            $sql = "INSERT INTO \"Pool\" VALUES ('$imei','CHECKALLPOINTS|$IDs');";
            $result = pg_query($connection, $sql);
        } else {
            $sql = "UPDATE \"Pool\" SET pool_command=pool_command||';CHECKALLPOINTS|$IDs' WHERE \"pool_IMEI\"='$imei';";
            $result = pg_query($connection, $sql);
        }
        break;

    case 'MESSAGE':
        echo $data;
        $sql = "SELECT count(*) FROM \"Pool\" WHERE \"pool_IMEI\"='" . $imei . "'";
        $result = pg_query($connection, $sql);
        $array = pg_fetch_array($result);
        pg_free_result($result);
        if ($array[0] == 0) {
            $sql = "INSERT INTO \"Pool\" VALUES ('$imei','MESSAGE|" . $data . "');";
            $result = pg_query($connection, $sql);
        } else {
            $sql = "UPDATE \"Pool\" SET pool_command=pool_command||';MESSAGE|" . $data . "' WHERE \"pool_IMEI\"='$imei';";
            $result = pg_query($connection, $sql);
        }
        break;

    case 'STOPPOINT':
        $data = json_decode($data, true);
        $sql = "INSERT INTO \"Stoppoints\" (sid, \"s_IMEI\", lat, lon, \"time\", \"desc\", \"status\") VALUES ('" . $data['sid'] . "', '" . $imei . "', '" . $data['lat'] . "', '" . $data['lon'] . "', '" . $data['time'] . "', '" . $data['desc'] . "', '-1');";
        pg_query($sql);
        $sql = "SELECT count(*) FROM \"Pool\" WHERE \"pool_IMEI\"='" . $imei . "'";
        $result = pg_query($connection, $sql);
        $array = pg_fetch_array($result);
        pg_free_result($result);
        if ($array[0] == 0) {
            $sql = "INSERT INTO \"Pool\" VALUES ('$imei','STOPPOINT|" . $data['sid'] . "');";
            $result = pg_query($connection, $sql);
        } else {
            $sql = "UPDATE \"Pool\" SET pool_command=pool_command||';STOPPOINT|" . $data['sid'] . "' WHERE \"pool_IMEI\"='$imei';";
            $result = pg_query($connection, $sql);
        }
        echo $sql;
        break;

    case 'DRIVERID':
        $sql = 'SELECT *  FROM "Boxes";';
        $result = pg_query($connection, $sql);
        while ($array = pg_fetch_array($result)) {
            echo '<option value="' . $array["IMEI"] . '">' . $array["DRIVER_ID"] . ' ---- Status [' . $array
            ["STATUS"] . ']</option>';
        }
        pg_free_result($result);
        break;

    case 'INBOX':
        $sql = "SELECT *  FROM \"SentMessages\"  "
                . "FULL OUTER JOIN  \"RecvMessages\"  "
                . "ON  \"SentMessages\".mesg_id = \"RecvMessages\".linkid  "
                . "AND \"SentMessages\".\"mesg_IMEI\" = \"RecvMessages\".\"Box_IMEI\"  "
                . "ORDER BY \"SentMessages\".mesg_id ASC;";
        $result = pg_query($connection, $sql);
        $html = '';
        while ($array = pg_fetch_array($result)) {
            if ($array["mesg_id"] && $array["linkid"]) {
                $html .= "<li class='sent'>ส่ง: [" . pack("H*", $array["mesg_id"]) . "] " . $array["mesg_message"] . "</li>\n";
                $html .= "<ul><li class='reply'>ตอบ: " . $array["message"] . " </li></ul>\n";
            }
            if (!$array["linkid"] && $array["mesg_id"]) {
                $html .= "<li class='sent'>ส่ง: [" . pack("H*", $array["mesg_id"]) . "] " . $array["mesg_message"] . "</li>\n";
            }
            if (!$array["mesg_id"] && !$array["linkid"]) {
                $html .= "<li class='recv'>รับ: " . $array["message"] . "</li>\n";
            }
        }
        echo $html;
        break;

    case 'STOPPOINTSTATUS':
        $sql = 'SELECT * FROM "Stoppoints" WHERE "s_IMEI"=\'' . $imei . '\' ORDER BY "listIndex" ASC; ';
        $result = pg_query($connection, $sql);
        while ($row = pg_fetch_array($result)) {
            $disp = 'ยังไม่ส่ง';
            if ($row['status'] == '100') {
                $disp = 'กำลังเดินทาง';
            } else if ($row['status'] == '101') {
                $disp = 'เรียบร้อยแล้ว';
            } else if ($row['status'] == '102') {
                $disp = 'ยังไม่ได้อ่าน';
            } else if ($row['status'] == '103') {
                $disp = 'อ่านแล้ว';
            }
            if ($row['status'] == '104') {
                $disp = 'ลบแล้ว';
            }

            echo '<tr class="sp_' . $row['status'] . '"><td>' . hexdec($row['sid']) . '</td><td>' . $row['desc'] . '</td><td>' . $disp . '</td></tr>';
        }
        pg_free_result($result);
        break;

    case 'PVT':
        $sql = "SELECT count(*) FROM \"Pool\" WHERE \"pool_IMEI\"='" . $imei . "'";
        $result = pg_query($connection, $sql);
        $array = pg_fetch_array($result);
        pg_free_result($result);
        if ($array[0] == 0) {
            $sql = "INSERT INTO \"Pool\" VALUES ('$imei','PVT|" . $data . "');";
            $result = pg_query($connection, $sql);
        } else {
            $sql = "UPDATE \"Pool\" SET pool_command=pool_command||';PVT|" . $data . "' WHERE \"pool_IMEI\"='$imei';";
            $result = pg_query($connection, $sql);
        }
        break;

    case 'ETA':
        echo 'ETA';
        $sql = "SELECT count(*) FROM \"Pool\" WHERE \"pool_IMEI\"='" . $imei . "'";
        $result = pg_query($connection, $sql);
        $array = pg_fetch_array($result);
        pg_free_result($result);
        if ($array[0] == 0) {
            $sql = "INSERT INTO \"Pool\" VALUES ('$imei','ETA');";
            $result = pg_query($connection, $sql);
        } else {
            $sql = "UPDATE \"Pool\" SET pool_command=pool_command||';ETA' WHERE \"pool_IMEI\"='$imei';";
            $result = pg_query($connection, $sql);
        }
        break;

    case 'ETA_QUERY':
        break;
}
pg_close($connection);


