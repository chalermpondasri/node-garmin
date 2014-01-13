<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="initial-scale=1.0, user-scalable=no">
        <script src="jquery-2.0.3.min.js"></script>
        <style>
            html, body, #map-canvas {
                height: 400px;
                width: 400px;
                margin: 0px;
                padding: 0px
            }
            .sent{
                background-color: #5ECC85

            }
            .recv{
                background-color: #F5CEFF
            }
            .reply{
                background-color: #ACFF8F
            }
            .sp_100{
                background-color: lightgreen;
                font-weight: bold
            }
            .sp_101{
                background-color: lightblue;

            }
            .sp_102{
                background-color: lightgray;
                color: grey;
            }
            .sp_103{
                background-color: lightgrey;
            }
            .sp_104{

                background-color: lightcoral;
            }

        </style>

        <script src="https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=false"></script>

        <script>
            var postFile = "pooling.php";

            function getTimeFrom1989() {
                var d = new Date().getTime();
                d = (d / 1000) - 0x259D4C00;
                d = d.toString(16).split('.')[0];
                return d;
            }
            function toRadians(val) {
                return parseInt(((parseFloat(val) / 180) * Math.pow(2, 31))).toString(16);
            }
            function zerofill(input, length, padleft) {
                if (input.length % 2 !== 0) {
                    input = '0' + input;
                }
                if (length) {
                    var returnData = input;
                    for (var i = input.length / 2; i < length; i++) {
                        if (padleft) {
                            returnData = '00' + returnData;
                        } else {
                            returnData += '00';
                        }

                    }
                    return returnData;
                }
                return input;
            }
            $(document).ready(function() {
                var log = $('#console');

                function refreshDriverID() {
                    setTimeout(refreshDriverID, 10000);
                    log.text('data');
                    $.post(postFile,
                            {
                                CMD: 'DRIVERID'
                            }, function(data, status) {
                        $("#deviceList").html(data);
                    }).fail(function() {
                        log.html('failed!');
                    });
                }

                function refreshInbox() {
                    setTimeout(refreshInbox, 10000);
                    $.post(postFile,
                            {
                                CMD: 'INBOX',
                                IMEI: $("#deviceList option:selected").val()
                            }, function(data, status) {
                        $("#inboxMessage").html(data);
                    }).fail(function() {
                        log.html('failed!');
                    });
                }

                function refreshStoppointStatus() {
                    setTimeout(refreshStoppointStatus, 10000);
                    $.post(postFile,
                            {
                                CMD: 'STOPPOINTSTATUS',
                                IMEI: $("#deviceList option:selected").val()
                            }, function(data, status) {
                        $("#sp_status").html(data);
                    }).fail(function() {
                        log.html('failed!');
                    });
                }

                function refreshETA() {
                    setTimeout(refreshETA, 10000);
                    $.post(postFile,
                            {
                                CMD: 'ETA_QUERY',
                                IMEI: $("#deviceList option:selected").val()
                            }, function(data, status) {
                        $("#eta").html(data);
                    }).fail(function() {
                        log.html('failed!');
                    });
                }


                refreshDriverID();
                refreshInbox();
                refreshStoppointStatus();
                refreshETA();

                google.maps.event.addDomListener(window, 'load', initialize);
                //-------------- initializing ----------
                $("#sid").val((new Date().getTime() >> 4) & 0xFFFF);
                //--------------------------------------


                $("#sendMessageButton").click(function() {
                    var v = $("#messageForm").serialize();
                    $.post(postFile,
                            {
                                IMEI: $("#deviceList option:selected").val(),
                                CMD: 'MESSAGE',
                                DATA: v
                            }, function(data, status) {
                        alert(status + ': Message Stored!!');

                        log.html(data);
                    }).fail(function() {
                        log.html('failed!');
                    });
                });
                $("#checkAll").click(function() {
                    $.post(postFile,
                            {
                                IMEI: $("#deviceList option:selected").val(),
                                CMD: 'CHECKALLPOINTS'
                            }, function(data, status) {
                        alert(status + ': Command Stored!!');

                        log.html(data);
                    }).fail(function() {
                        log.html('failed!');
                    });
                });
                $("#refreshButton").click(function() {
                    // refresh the device list , WIP
                });
                $("#go").click(function() {
                    var input = $("#util").val();
                    var out = "";
                    for (var q = 0; q < input.length / 2; q++) {
                        out += '0x' + input.substr(q * 2, 2) + ' ';
                    }
                    $("#output").val(out.trim());
                });

                $("#go2").click(function() {
                    var val = parseFloat($("#conv").val());
                    $("#convDiv").html(((val / 180) * Math.pow(2, 31)).toString(16));

                });

                $("#requestETA").click(function() {
                    $.post(postFile,
                            {
                                IMEI: $("#deviceList option:selected").val(),
                                CMD: 'ETA'
                            }, function(data, status) {
                        alert(status + ': Command Stored!!');
                        log.html(data);
                    }).fail(function() {
                        log.html('failed!');
                    });
                });
                $("#sid").click(function() {
                    $(this).val('');
                });
                $("#stoppointBtn").click(function() {
                    if (!$("#sid").val() || !$("#lat").val() || !$("#lon").val() || !$("#sp_text").val()) {
                        alert('Please fill all the field.');
                        return;
                    }
                    var sid = zerofill(parseInt($("#sid").val()).toString(16), 4, true);
                    var lat = zerofill(toRadians($("#lat").val()), 4);
                    var lon = zerofill(toRadians($("#lon").val()), 4);
                    var time = (getTimeFrom1989());
                    var desc = $("#sp_text").val();
                    var str = sid + "\n" + lat + "\n" + lon + "\n" + time + "\n" + desc;
                    //alert(str);

                    var v = {
                        sid: sid,
                        lat: lat,
                        lon: lon,
                        time: time,
                        desc: desc
                    };
                    $.post(postFile,
                            {
                                IMEI: $("#deviceList option:selected").val(),
                                CMD: 'STOPPOINT',
                                DATA: JSON.stringify(v)
                            }, function(data, status) {
                        log.html(data);
                        alert(status + ': Message Stored!!');
                    }).fail(function() {
                        log.html('failed!');
                    });
                });
                $("#pvt_enable").click(function() {
                    $.post(postFile,
                            {
                                IMEI: $("#deviceList option:selected").val(),
                                CMD: 'PVT',
                                DATA: 'ON'
                            }, function(data, status) {
                        alert(status + ': Command Stored!!');
                        log.html(data);
                    }).fail(function() {
                        log.html('failed!');
                    });
                });
                $("#pvt_disable").click(function() {
                    $.post(postFile,
                            {
                                IMEI: $("#deviceList option:selected").val(),
                                CMD: 'PVT',
                                DATA: 'OFF'
                            }, function(data, status) {
                        alert(status + ': Command Stored!!');
                        log.html(data);
                    }).fail(function() {
                        log.html('failed!');
                    });
                });




            }
            );



            function initialize() {
                navigator.geolocation.getCurrentPosition(function(pos) {
                    var latlng = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
                    var mapOptions = {
                        center: latlng,
                        zoom: 10,
                        mapTypeId: google.maps.MapTypeId.ROADMAP,
                        mapTypeControl: false,
                        navigationControlOptions: {style: google.maps.NavigationControlStyle.SMALL}
                    };
                    var map = new google.maps.Map(document.getElementById('map-canvas'),
                            mapOptions);
                    var marker = new google.maps.Marker({position: latlng, map: map, title: pos.coords.latitude + " , " + pos.coords.longitude});
                    google.maps.event.addListener(marker, 'click', function(event) {

                        map.setZoom(map.getZoom() + 1);
                        map.setCenter(marker.getPosition());
                    });
                    google.maps.event.addListener(map, 'rightclick', function(event) {
                        //map.setZoom(map.getZoom() - 1);
                        map.panTo(latlng);
                        marker.setPosition(latlng);
                        $("#lat").val(latlng.lat());
                        $("#lon").val(latlng.lng());
                    });


                    google.maps.event.addListener(map, 'click', function(event) {
                        var lat = event.latLng.lat();
                        var lng = event.latLng.lng();
                        marker.setPosition(event.latLng);
                        marker.setTitle(lat + " , " + lng);
                        map.panTo(event.latLng);
                        $("#lat").val(lat);
                        $("#lon").val(lng);
                    });




                });

            }

        </script>
        <title>GS818-Garmin Web Interface</title>

    </head>
    <body>
        Driver ID:<select id="deviceList" style="width: 300px">
        </select>
        <button id="pvt_enable">Enable PVT</button>
        <button id="pvt_disable">Disable PVT</button>
        <button id="requestETA">Request ETA</button><br>
        Estimated Time Arrivals: <span id="eta">eta</span>
        <br><br>
        <hr>
        <h2>Messages</h2>
        <form id="messageForm">
            <label for="messageID">Message ID</label><input type="text" name="messageID" id="messageID"><br>
            <label for="message">Message Body</label><input name="message" id="message" type="text"><br>
            <label for="messageType">Message Type</label>
            <select name="messageType" id="messageType">
                <option value="002a">Normal Message</option>
                <option value="0022">Simple OK Acknowledge</option>
                <option value="0023">Simple Yes/No Acknowledge</option>
            </select><br>
            Immediately show message <input name="immediate" type="checkbox" id="immediate"><br>
        </form>
        <button id="sendMessageButton">Send Message to Selected Driver ID</button>

        <h2>Inbox</h2>
        <ul id="inboxMessage" class="inboxMessage">

        </ul>

        <hr>
        <h2>Stop Points</h2> 
        <table style="width: 800px">
            <tr>
                <td>
                    Left Click: Place a marker and get the position<br>
                    Right Click : Place a marker at your current position
                    <div id="map-canvas"></div>
                </td>
                <td style="vertical-align: top; width: 400px">       
                    <form id="stoppointsForm" >
                        ID: <input type="number" id="sid"/> *as number<br>
                        Latitude:<input type="number" id="lat" name="lat" /><br>
                        Longitude: <input type="number" id="lon" name="lon"/><br>
                        Description: <input type="text" id="sp_text"><br>
                    </form>
                    <button id="stoppointBtn" >Send</button>
                    <hr>
                    <h3>Stop Points Status</h3>
                    <button id="checkAll" disabled>Check All</button>
                    <table id="sp_status">
                    </table>
                </td>
            </tr>
        </table>

        <hr>
        <br><br>
        <textarea id="console" readonly="true" style="width: 500px;height: 150px;color:green;background-color: black">console :D</textarea>



        <br>
        <br>

        Utils<br>
        Input: <input type="text" id="util"><button id="go">GO</button><br>
        Output: <input type="text" id="output"><br>
        <input id ="conv" type="number"><button id="go2">GO2</button><br>
        <div id="convDiv"></div>

    </body>
</html>
