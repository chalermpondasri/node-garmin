//------------- requires ---------

var cluster = require('cluster');
var net = require('net');
var Utils = require('util');
var buffer = require('buffer');
var http = require('http');
var pg = require('pg');
var colors = require('colors');
var pgConnectionInfo =
        {
            user: 'postgres',
            password: 'password',
            database: 'xsense',
            host: 'localhost',
            port: 5432
        };
/**
 * Number of CPU Cores
 * @type Number
 */
var numCPUs = require('os').cpus().length;
/**
 * Open port for incoming box request
 * @type Number
 */
var boxPort_listening = 6543;
if (cluster.isMaster) {
//Fork new clients equal to cpu cores
    for (var i = 0; i < numCPUs; i++) {
        var worker = cluster.fork();
    }
    cluster.on('exit', function(worker, code, signal) {
        var newWorker = cluster.fork();
        Utils.log('MASTER: PID ' + worker.process.pid + ' died(' + code + '), Fork new PID ' + newWorker.process.pid);
    });
    Utils.log('Server Start!');
} else {
// ------------------ HTTP Server ------------------------
//    var HTTPServer = http.createServer(function(request, response) {
//        var httpData;
//        request.on('data', function(chunk) {
//            var data = chunk.toString();
//            httpData = getInfo(data, "&");
//            //console.log(httpData);
//            switch (httpData.CMD) {
//                case 'ENABLE':
//                    break;
//                case 'MESSAGE':
//                    break;
//                default:
//                    break;
//            }
//        });
//        response.writeHead(200, {
//            'Content-Type': 'text/html',
//            'Access-Control-Allow-Origin': '*'
//        });
//        response.end('Hello World\n');
//    });
//    HTTPServer.listen(1337);
//---------------------------------------------------------
    var TCPServer = net.createServer(function(socket) {
        socket.setTimeout(12 * 60 * 1000, function() { // 12 minutes timeout inactive
            Utils.log('Connection Time-out.');
            socket.end();
            socket.destroy();
            TCPServer.getConnections(function(error, count) {
                Utils.log('Remaining Connection: ' + count);
            });
        });
        console.log('\n----------------------------------------------------');
        Utils.log('PID ' + process.pid + ' accepted connection from ' + socket.remoteAddress + ':' + socket.remotePort);
        TCPServer.getConnections(function(error, count) {
            Utils.log('Total Connection: ' + count);
        });
        var box = new Box(socket);
    });
    TCPServer.listen(boxPort_listening, function() {
        Utils.log('Cluster[' + process.pid + '] Listening on port ' + boxPort_listening);
    });
}

//---------- Objects-------------------
// Queue Abstract Datatype implementation
function Queue() {
    var array = new Array();

    /**
     * Check inf the given data already exist in the queue
     * @param {type} data input data
     * @returns {Boolean} result
     */
    this.isDuplicate = function(data) {
        return array.indexOf(data) > -1 ? true : false;
    };
    /**
     * Put the specific object into the queue and return the queue size
     * @param {type} data
     * @returns {Number}
     */
    this.enqueue = function enqueue(data) {
        if (!this.isDuplicate(data)) {
            array.push(data);
        }
        return array.length;
    };
    /**
     * Remove and return the first object in queue
     * @returns {Object}
     */
    this.dequeue = function dequeue() {
        return array.shift();
    };
    /**
     * Get the queue size
     * @returns {Number}
     */
    this.size = function() {
        return array.length;
    };
    /**
     * check if the queue iis empty
     * @returns {Boolean}
     */
    this.isEmpty = function() {
        return array.length === 0;
    };
    this.toString = function() {
        return ('Queue: ' + array).green;
    };
}
// Stack Abstract Datatype implementation
function Stack() {
    var array = new Array();
    this.push = function(data) {
        return array.push(data);
    };
    this.pop = function() {
        return array.pop();
    };
    this.size = function() {
        return array.length;
    };
    this.isEmpty = function() {
        return array.length === 0;
    };
}
// Map Abstract Datatype implementation
function Map() {
    var array = new Array();
    this.size = function() {
        return array.length;
    };
    this.get = function(key) {
        return array[key];
    };
    this.put = function(key, value) {
        array[key] = value;
        return array.length;
    };
    this.isEmpty = function() {
        return array.length === 0;
    };
    this.remove = function(key) {
        var v = array[key];
        delete array[key];
        return v;
    };
}

function Pool() {
    var array = new Array();
    /**
     * get the pool size
     * @returns {Number}
     */
    this.size = function() {
        return array.length;
    };
    /**
     * Put new object into the pool
     * @param {type} data
     * @returns {Number}
     */
    this.put = function(data) {
        return array.push(data);
    };
    /**
     * Remove and return the specific object from the pool, return -1 if not found
     * @param {type} data
     * @returns {Number}
     */
    this.remove = function(data) {
        var index = array.indexOf(data);
        if (index !== -1) {
            delete array[index];
        }
        return index;
    };
    /**
     * Check if the pool is empty
     * @returns {Boolean}
     */
    this.isEmpty = function() {
        return array.length === 0;
    };
    /**
     * Check if the pool contains thhe object, return -1 if not found
     * @param {type} data
     * @returns {Number}
     */
    this.contains = function(data) {
        return array.indexOf(data);
    };
    this.toString = function() {
        return array;
    };
}

function Box(SOCKET) {
// Members
    var socket = SOCKET;
    var info;
    var sentPacket;
    var packetType;
    var boxInfo;
//    var sentCommandPool = new Pool();
    var commandQueue = new Queue();
    socket.on('data', function(packet) {
        var recvPacket = packet.toString();
        console.log('------------ Start of chunk --------------'.red);
        console.log(('Received Data[' + recvPacket + ']').green);
        console.log('------------ End of chunk --------------'.red);
        recvPacket = recvPacket.replace('\r', '');
        recvPacket = recvPacket.replace('\n', '');
        info = getInfo(recvPacket, ",");
        packetType = getDataPacketType(recvPacket);
        switch (packetType) {
            case 'GREET':
                Utils.log('Connection from: ' + info.IMEI);
                boxInfo = info;
                initCommandQueue();
                Utils.log('GARMIN Enabling...');
                sentPacket = sendFMICommand('10a10c00000400018002800a000b00371003');
                //sentCommandPool.put(sentPacket);
                break;
            case 'OK':
                Utils.log('GS818 replied: OK!');
                Utils.log('Get Pooling Command from database...');
                pg_getPoolingCommand(info.IMEI, function(result) {
                    if (result !== null) {
                        for (var i = 0; i < result.length; i++) {
                            commandPoolHandler(result[i]);
                        }
                        pg_removePoolingCommandField(info.IMEI);

                    }
                });

                // Utils.log(commandQueue.toString());

                if (!commandQueue.isEmpty()) {
                    Utils.log('Fetching remaining command in queue...'.red);
                    sentPacket = sendFMICommand(commandQueue.dequeue());
//                    sentCommandPool.put(sentPacket);
                }
//                Utils.log('Sent Packet Command Pool: ' + sentCommandPool.toString());
                break;
            case 'FMI':
                var detail = getFMIDetail(info.FMI);
                FMIHandler(detail);
                break;
            case 'FAIL':
                Utils.log('GS818 replied: FAIL!'.red);
                break;
            default:
                console.error('Unknow Packet Type !!!');
                break;
        }

        return;
//---------------------------------------------------------------------------------

    }).on('end', function() {
        console.log('end');
    }).on('close', function() {
        Utils.log('PID ' + process.pid + ': Communication End');
        TCPServer.getConnections(function(error, count) {
            Utils.log('Remaining Connection: ' + count);
        });
        console.log('----------------------------------------------------\n\n');
    });
//--------- Member Functions -----------------

    function FMIHandler(detail, callback) {
        //  console.log(detail);
        switch (detail.TYPE) {
            case 'ACK':
                Utils.log('Got ACK Packet');
                //sentCommandPool.remove((detail.DATA).substr(0, 2)); // ack data contain 1 byte of reserved
                //Utils.log('Remaining Packet ID: ' + sentCommandPool.toString());
                break;
            case 'NACK':
                Utils.log('Got NACK!');
                break;
            case 'PVT':
                Utils.log('Got PVT!');
                PVTDataHandler(detail.DATA, function(result) {
                    sendFMICommand(ACKBuilder(detail.ID));
                });
                break;
            case 'ESN':
                Utils.log('Got ESN');
                //sendFMICommand(ACKBuilder(detail.ID));
                break;
            case 'FMP':
                //Utils.log('Got FMP');
                FMPHandler(detail);
                break;
        }

        if (callback) {
            callback();
        }
        return;
    }


    function FMPHandler(detail) {

        var FMIPacketID = getClientFMIPacketID(detail.RAW);
        switch (FMIPacketID.value) {
            case 0x0002: // Product ID Data -- ID, Version
                // insert and simply ack
                Utils.log('ACK to Product ID Packet');
                sendFMICommand(ACKBuilder(detail.ID));
                break;
            case 0x0003:
                Utils.log('ACK to Support Data');
                sendFMICommand(ACKBuilder(detail.ID));
                break;

            case 0x0020:
                Utils.log('Got FMP - Text Message ACK');
                sendFMICommand(ACKBuilder(detail.ID));
                get0x0020MessageACKDetail(detail.DATA, function(result) {
                    console.log(result);
                    switch (parseInt(result.ANSWER, 16)) {
                        case 0:
                            result.MESSAGE = 'OK';
                            break;
                        case 1:
                            result.MESSAGE = 'YES';
                            break;
                        case 2:
                            result.MESSAGE = 'NO';
                            break;
                        default:
                            result.MESSAGE = 'UNKNOW';
                            break;

                    }
                    pg_insertMessage(info.IMEI, result);
                    commandQueue.enqueue(ACKRecipeBuilder(result.ID));
                });
                break;

            case 0x0026://  A607 Client to Server Text Message
                Utils.log('Got FMP -  A607 Client to Server Text Message');
                get0x0026MessageDetail(detail.DATA, function(result) {
                    console.log(result);
                    commandQueue.enqueue(textMessageRecipeBuilder(result.UNIQUEID));
                    pg_insertMessage(boxInfo.IMEI, result);
                    sendFMICommand(ACKBuilder(detail.ID));
                });

                break;

            case 0x002b: // Text Message Recipt
                Utils.log('Got FMP - Text Message Recipe');
                sendFMICommand(ACKBuilder(detail.ID));
                //console.log('+++++++++++++++++++++++'.yellow);
                get0x002bMessageRecipeDetail(detail.DATA, function(result) {
                    // ---
                    console.log('---------------------'.yellow);
                    console.log(result);
                });
                break;

            case 0x0041: // Text Message Status
                //console.log(detail);
                Utils.log('Got FMP - Text Message Status');

                get0x0041TextMessageStatusDetail(detail.DATA, function(result) {
                    Utils.log('PG: Updating Message Status');
                    pg_updateMessageStatus(result);
                    sendFMICommand(ACKBuilder(detail.ID));
                });
                break;

            case 0x0201: // ETA Data
                Utils.log('Got FMP - ETA');
                getETADetail(detail.DATA, function(result) {
                    commandQueue.enqueue(ETAReceiptBuilder(result.UNIQUEID));
                    sendFMICommand(ACKBuilder(detail.ID));
                });
                break;

            case 0x0211: // Stop Status
                Utils.log('Got FMP - Stop Status');
                getStopIDAndStatus(detail.DATA, function(result) {
                    commandQueue.enqueue(stopStatusReciptBuilder(result.ID));
                    pg_updateStoppointStatus(result);
                    sendFMICommand(ACKBuilder(detail.ID));
                });
                break;

            case 0x0813:// Driver ID Update D607
                Utils.log('Got FMP - Driver ID Packet');
                getDriverID(detail.DATA, function(driverID) {
                    //console.log(IDReceiptBuilder(driverID.CHANGEID));
                    Utils.log('Driver ID:');
                    console.log(driverID);
                    Utils.log('Create ACK to Driver ID Packet');
                    sendFMICommand(ACKBuilder(detail.ID));
                    Utils.log('Create ID Receipt Builder');
                    sentPacket = sendFMICommand(IDReceiptBuilder(driverID.CHANGEID));
                    //sentCommandPool.put(sentPacket);

                    boxInfo.DRIVER_ID = driverID.DRIVER_ID;
                    Utils.log('Putting Box Info and Driver ID to the  Database...');
                    pg_putNewBoxInfo(boxInfo);
                });
                break;

            case 0x0802: // Set Driver Status List Item Receipt
                Utils.log('Got FMP - Set Driver Status List Item Receipt');
                sendFMICommand(ACKBuilder(detail.ID));
                break;

            case 0x0823: // A607 Driver Status Update
                Utils.log('Got FMP - Driver Status Update');
                getDriverStatus(detail.DATA, function(result) {
                    boxInfo.DRIVER_STATUS = result.STATUSID;
                    pg_updateDriverStatus(result.STATUSID);
                    sentPacket = sendFMICommand(statusReceiptBuilder(result.CHANGEID));
//                    sentCommandPool.put(sentPacket);
                });
                break;

            default:
                console.error('Unhandled FMP packet:'.red);
                console.error(detail.data);
                break;
        }

    }


    function PVTDataHandler(DATA, callback) {
        var result = new Array();
        result.AlT ='';
        result.EPE = '';
        result.EPV = '';
        result.EPH = '';
        result.GPSFIX = '';
        result.TIMEOFWEEK ='';
        result.LAT = '';
        result.LON = '';
        result.EASTVEL = '';
        result.NORTHVEL = '';
        result.UPVEL = '';
        result.ABOVESEA = '';
        result.LEAPSECS = '';
        result.NUMWEEKDAYS = '';
        
        console.log(DATA);
        if (callback) {
            callback(result);
        }
    }
    function stopStatusReciptBuilder(uid) {
        var result = 'a1061202' + reversePacket(uid);
        result = '10' + result + calChecksum(result) + '1003';
        return result;

    }


    function getStopIDAndStatus(data, callback) {
        var result = new Array();
        result.ID = reversePacket(data.substr(4, 8));
        result.STATUS = parseInt(data.substr(12, 2), 16);
        result.INDEX = parseInt(data.substr(14, 4), 16);
        if (callback) {
            return callback(result);
        }
        return result;
    }

    function  stoppointBuilder(sid) {
        console.log('getting stoppoint data...');
        pg_getStoppointDetail(sid, function(result) {
            console.log(result);
            var r = '0101' + reversePacket(result.time) + reversePacket(result.lat) + reversePacket(result.lon) + reversePacket(result.sid) + unicodeEncode(result.desc) + '00';
            r = 'a1' + getPayloadSize(r) + r;
            r = '10' + r + calChecksum(r) + '1003';
            commandQueue.enqueue(r);
        });



    }



    /**
     * Convert a Hex String to array of int
     * @param {type} hexString
     * @returns {Array}
     */
    function hexStringToByteArray(hexString) {
        var bytes = new Array();
        for (var i = 0; hexString.length !== 0; hexString = hexString.substring(2, hexString.length), ++i) {
            var hex = hexString.substring(0, 2);
            bytes[i] = parseInt(hex, 16);
        }
        return bytes;
    }
    /**
     * Extract the driver information from payloaded data
     * @param {type} DATA payload data
     * @param {callback} callback callback function
     * @returns {Array} array of information
     */

    function getDriverID(DATA, callback) {
        var result = new Array();
        result.CHANGEID = reversePacket(DATA.substr(4, 8));
        result.CHANGETIME = reversePacket(DATA.substr(12, 8));
        result.DRIVER_ID = unicodeDecode(hexStringToByteArray(DATA.substring(28, DATA.length - 2)));
        if (callback) {
            callback(result);
        }
    }

    function getDriverStatus(DATA, callback) {
        //0813000000D96F2F2D01000000000000006A1003
        var result = new Array();
        result.CHANGEID = reversePacket(DATA.substr(4, 8));
        result.CHANGETIME = reversePacket(DATA.substr(12, 8));
        result.STATUSID = reversePacket(DATA.substr(22, 8));
        result.DRIVERINDEX = 0; // For Single Driver, Only have index 0;
        console.log(result);
        if (callback) {
            callback(result);
        }
        return result;

    }

    function statusListBuilder(id, statusText, callback) {
        var hexID = zeroTailPadding(parseInt(id, 16), 4);
        var text = unicodeEncode(statusText);
        var result = '0008' + hexID + text + '00';
        result = 'a1' + getPayloadSize(result) + result;
        result = '10' + result + calChecksum(result) + '1003';
        if (callback) {
            callback(result);
        }

        return result;
    }

    function get0x002bMessageRecipeDetail(data, callback) {
        var result = new Array();
        result.TIME = reversePacket(data.substr(4, 8));
        result.ID = data.substr(20, parseInt(12, 16));
        result.SUCCESS = (data.substr(14, 2) === '01') ? true : false;

        if (callback) {
            callback(result);
        }
        return result;
    }

    function get0x0020MessageACKDetail(data, callback) {
        console.log(data);
        var result = new Array();
        result.TIME = reversePacket(data.substr(4, 8));
        result.IDSIZE = parseInt(data.substr(12, 2), 16);
        result.ID = reversePacket(data.substr(20, 2 * result.IDSIZE));
        result.ANSWER = reversePacket(data.substring(52));
        result.LINKEDID = result.ID;
        result.UNIQUEID = 'FFFFFFFF';
        result.LAT = '80000000';
        result.LON = '80000000';
        if (callback) {
            callback(result);
        }
        return result;
    }

    function get0x0041TextMessageStatusDetail(data, callback) {
        console.log(data);
        var result = new Array();
        result.MESG_ID = '';
        result.STATUS = -1;
        var idSize = parseInt(data.substr(4, 2), 16);
        result.MESG_ID = data.substr(12, idSize * 2);
        result.STATUS = parseInt(data.substr(6, 2), 16);
        console.log(result);
        if (callback) {
            callback(result);
        }
        return result;
    }

    function get0x0026MessageDetail(data, callback) {
        var result = new Array();
        result.TIME = '';
        result.LAT = '';
        result.LON = '';
        result.UNIQUEID = '';
        result.LINKIDSIZE = 0;
        result.LINKEDID = '';
        result.MESSAGE = '';
        //-------------------

        result.TIME = reversePacket(data.substr(4, 8)); // starting with 4th byte for 4 bytes
        result.LAT = reversePacket(data.substr(12, 8));
        result.LON = reversePacket(data.substr(20, 8));
        result.UNIQUEID = reversePacket(data.substr(28, 8));
        result.MESSAGE = unicodeDecode(hexStringToByteArray(data.substring(76, data.length - 2)));
        result.LINKIDSIZE = parseInt(data.substr(36, 2), 16);
        result.LINKEDID = data.substr(44, result.LINKIDSIZE * 2);
        if (callback) {
            callback(result);
        }
        return result;
    }

    function textMessageRecipeBuilder(UNIQUEID) {
        var message = 'a1062500' + reversePacket(UNIQUEID);
        message = '10' + message + calChecksum(message) + '1003';
        return message;
    }

    function stopPointBuilder() {

    }


    function getChecksumByte(RAW) {
        return RAW.substr(RAW.length - 6, 2);
    }

    /**
     * Calculate the 2'complement packpet checksum and return if data valid or not 
     * @param {Text} byteString RAW Packet data input
     * @returns {Boolean} result true if packet checksum is valid
     */
    function isPacketValid(byteString) {
        var expected = getChecksumByte(byteString);
        var calc = calChecksum(byteString.substring(2, byteString.length - 8));
        return expected === calc;
    }

    /**
     * Calculate the checksum of ALL input data
     * @param {type} byteString
     * @returns {String}
     */
    function calChecksum(byteString) {
        var hexStr = '';
        var sum = 0;
        for (var i = 0; i < byteString.length / 2; i++) {
            hexStr = byteString.substr(i * 2, 2);
            //    console.log('current : ' + sum + ', hex: ' + hexStr.toString(16) + ', total : ' + (sum + parseInt(hexStr, 16)));
            sum = sum + parseInt(hexStr, 16);
        }
        sum = ((0xFFF - sum) + 1) & 0xFF >>> 0;
        //console.log('SUM: 0x' + sum.toString(16));
        sum = sum.toString(16);
        if (sum.length < 2) {
            sum = '0' + sum;
        }
        return sum;
    }

    /**
     * Convert input message to sending data
     * @param {array} msg message object
     * @returns {text} command FMI Command Format
     */
    function messageBuilder(msg) {
        // { messageID: 'ab', message: 'a¡', messageType: '01' }

        var cmd_esc = '10'; // 1 byte
        var cmd_pid = 'a1'; // 1 byte
        var cmd_data = messageDataBuilder(msg);
        var cmd_dataSize = getPayloadSize(cmd_data); // 1 byte
        var cmd_checkSum = calChecksum(cmd_pid + cmd_dataSize + cmd_data); // 1 byte
        var cmd_linkEsc = '10'; // 1 byte
        var cmd_eot = '03'; // 1 byte
        return cmd_esc + cmd_pid + cmd_dataSize + cmd_data + cmd_checkSum + cmd_linkEsc + cmd_eot;
    }

    function messageDataBuilder(msg) {
        var FMIset = reversePacket(msg.messageType); // 2 bytes
        var time = reversePacket(getTimeFrom1989()); // 4 bytes
        var msgID = zeroTailPadding(stringToHexString(msg.messageID), 16); // 16 byte
        var IDSize = getPayloadSize(stringToHexString(msg.messageID)); // 1 byte
        var msgType = (msg.immediate === 'on' && msg.messageType === '002a') ? '01' : '00'; // 1 byte
        var reserved = '0000'; // 2 bytes, 0x0000 only
        var mesg = unicodeEncode(msg.message) + '00';
        return FMIset + time + IDSize + msgType + reserved + msgID + mesg;
    }

    function unicodeEncode(message) {
        var buf = new Buffer(message);
        var mesg = '';
        for (var i = 0; i < buf.length; i++) {
            mesg += (buf[i]).toString(16);
        }

        return mesg;
    }

    function unicodeDecode(byteArray) {
        var buf = new Buffer(byteArray);
        return buf.toString();
    }


    function getPayloadSize(data) {
        var nn = (data.length / 2);
        nn = nn.toString(16);
        if ((nn.length % 2) !== 0) {
            nn = '0' + nn;
        }
        return nn;
    }

    function getTimeFrom1989() {
        var d = new Date().getTime();
        d = (d / 1000) - 0x259D4C00;
        d = d.toString(16).split('.')[0];
        return d;
    }


    /**
     * Reverse the input bytes
     * @param {text} packet
     * @returns {String} reversedPacket
     */
    function reversePacket(packet) {
        var array = new Array();
        var length = packet.length / 2;
        for (var i = 0; i < length; i++) {
            array[length - (i + 1)] = packet.charAt(i * 2) + '' + packet.charAt((i * 2) + 1);
        }
        return array.join('');
    }

    function getETADetail(data, callback) {
        var result = new Array();
        result.UNIQUEID = reversePacket(data.substr(4, 8));
        result.ETA = reversePacket(data.substr(12, 8));
        result.DIST = reversePacket(data.substr(20, 8));
        result.LAT = reversePacket(data.substr(28, 8));
        result.LON = reversePacket(data.substr(36, 8));

        if (callback) {
            callback(result);
        }
        return result;
    }

    function ETAReceiptBuilder(uid) {
        var result = '0202' + reversePacket(uid);
        result = 'a1' + getPayloadSize(result) + result;
        result = '10' + result + calChecksum(result) + '1003';
        return result;
    }

    /**
     * Get type of received message
     * @param {type} message
     * @returns {String}
     */
    function getDataPacketType(message) {
        if (message.search('IMEI') !== -1 && message.search('VER') !== -1) {
            return 'GREET';
        } else
        if (message.search('OK') !== -1) {
            return 'OK';
        } else
        if (message.search('FAIL') !== -1) {
            return 'FAIL';
        } else
        if (message.search('FMI') !== -1) {
            return 'FMI';
        } else {
            return 'unhandle';
        }
    }
    /**
     * Sending the FMI command to Garmin via box throught the given socket
     * @param {FMI Command} command
     * @param {callback} callback callback function
     * @return {text} packet id
     */
    function sendFMICommand(command, callback) {
        var commandString = '@PCswFMI,' + info.IMEI + ',' + command + '\r\n';
        Utils.log('Sending Command: ' + commandString.substring(0, commandString.length - 2));
        socket.write(commandString);

        if (callback) {
            callback();
        }
        return getPacketID(command);
    }




    function ACKBuilder(ID) {
        var ackString = '0601' + ID;
        ackString = '10' + ackString + calChecksum(ackString) + '1003';
        //console.log('ackString =' + ackString);
        return ackString;
    }
    function IDReceiptBuilder(changeID) {
        changeID = 'a10a1208' + reversePacket(changeID) + '01000000';
        changeID = '10' + changeID + calChecksum(changeID) + '1003';
        // console.log(changeID);
        return changeID;
    }

    function statusReceiptBuilder(changeID) {
        changeID = 'a10a2208' + reversePacket(changeID) + '00000000';
        changeID = '10' + changeID + calChecksum(changeID) + '1003';
        return changeID;
    }

    function ACKRecipeBuilder(id) {
        id = 'a1162c00' + getPayloadSize(id) + '000000' + zeroTailPadding(id, 16);
        id = '10' + id + calChecksum(id) + '1003';
        return id;
    }

    function NACKBuilder(ID) {
        var nackString = '2101' + ID;
        nackString = '10' + nackString + calChecksum(nackString) + '1003';
        //console.log('ackString =' + ackString);
        return nackString;
    }

    /**
     * Get packet id from given command;
     * @param {text} command
     * @returns {String} packet ID
     */
    function getPacketID(command) {
        return command.substr(2, 2).toUpperCase();
    }

    /**
     * get the incoming FMI client request's Packket ID
     * @param {text} FMIPacket raw FMI packet from Garmin
     * @returns {Array} FMIPID array of packet detail including hex value and type
     */
    function getClientFMIPacketID(FMIPacket) {
        var FMIPID = new Array();
        FMIPID.original = reversePacket(FMIPacket.substr(6, 4));
        FMIPID.value = parseInt(FMIPID.original, 16);
        switch (FMIPID.value) {
            case 0x0002:
                FMIPID.type = 'PRODUCT_ID_DATA';
                break;
            case 0x0003:
                FMIPID.type = 'PROTOCOL_SUPPORT_DATA';
                break;
            case 0x0004:
                FMIPID.type = 'UNICODE_SUPPORT_REQUEST';
                break;
            case 0x0020:
                FMIPID.type = 'TXT_ACK';
                break;
            case 0x0024:
                FMIPID.type = 'TXT_OPEN_CTS';
                break;
            case 0x0026:
                FMIPID.type = 'A607_TXT';
                break;
            case 0x0029:
                FMIPID.type = 'CANNED_RESP';
                break;
            case 0x002b:
                FMIPID.type = 'TXT_RECV';
                break;
            case 0x0032:
                FMIPID.type = 'SET_CANNED_RESP_RECV';
                break;
            case 0x0033:
                FMIPID.type = 'DELETE_CANNED_RESP_RECV';
                break;
            case 0x0034:
                FMIPID.type = 'REQ_CANNED_RESP_RECV';
                break;
            case 0x0041:
                FMIPID.type = 'TXT_STATUS';
                break;
            case 0x0051:
                FMIPID.type = 'SET_CANNED_MSG_RECV';
                break;
            case 0x0053:
                FMIPID.type = 'DELETE_CANNED_MSG_RECV';
                break;
            case 0x0054:
                FMIPID.type = 'REFRESH_CANNED_MSG_LIST';
                break;
            case 0x0111:
                FMIPID.type = 'SORT_STOP_LIST_ACK';
                break;
            case 0x0131:
                FMIPID.type = 'CREATE_WAYPOINT_RECV';
                break;
            case 0x0133:
                FMIPID.type = 'WAYPOINT_DELETE';
                break;
            case 0x0138:
                FMIPID.type = 'CREATE_WAYPOINT_CATE_RECV';
                break;
            case 0x0201:
                FMIPID.type = 'ETA_DATA';
                break;
            case 0x0211:
                FMIPID.type = 'STOP_STATUS';
                break;
            case 0x0802:
                FMIPID.type = 'SET_DRIVER_STATUS_LIST';
                break;
            case 0x0803:
                FMIPID.type = 'DELETE_DRIVER_STATUS_LIST';
                break;
            case 0x0804:
                FMIPID.type = 'DRIVER_STATUS_LIST_REFRESH';
                break;
            case 0x0811:
                FMIPID.type = 'DRIVER_ID_UPDATE';
                break;
            case 0x0812:
                FMIPID.type = 'DRIVER_ID_RECV';
                break;
            case 0x0813:
                FMIPID.type = 'A607_DRIVER_ID_UPDATE';
                break;
            case 0x0821:
                FMIPID.type = 'DRIVER_STATUS_UPDATE';
                break;
            case 0x0822:
                FMIPID.type = 'DRIVER_STATUS_RECV';
                break;
            case 0x0823:
                FMIPID.type = 'D607_DRIVER_STATUS_UPDATE';
                break;
        }

        return FMIPID;
    }


    /**
     * Get the information from the message format 'KEY1=VALUE1{delim}KEY2=VALUE2'
     * @param {text} message
     * @param {text} delim delimiter between data set
     * @returns {Array}
     */
    function getInfo(message, delim) {
        var split = message.split(delim);
        var info = new Array();
        for (var i = 0; i < split.length; i++) {
            var str = split[i].split("=");
            info[str[0]] = str[1];
        }
        return info;
    }

    /**
     * Timestamp in [HH:MM:ss:mm] format
     * use in console.log();
     * @returns {String}
     */
    function timestamp() {
        var d = new Date();
        var timeString = "";
        timeString += "[" + d.getHours();
        timeString += ":" + d.getMinutes();
        timeString += ":" + d.getSeconds();
        timeString += ":" + d.getMilliseconds();
        timeString += "] ";
        return timeString;
    }


    /**
     * Split FMI data to coresponding field RAW, ID, SIZE, DATA, CHECKSUM
     * @param {type} FMI
     * @returns {Array}
     */
    function getFMIDetail(FMI) {
        var detail = new Array();
        /**
         * Raw Data
         */
        detail.RAW = FMI;
        /**
         * Packet ID
         */
        detail.ID = getPacketID(FMI);
        /**
         * Packet type as text
         */
        detail.TYPE = getPacketType(detail.ID);
        /**
         * Packet Size
         */
        detail.SIZE = intToHex(FMI.substr(4, 2));
        /**
         * Packet data payload
         */
        detail.DATA = FMI.substring(6, FMI.length - 6);
        /**
         * expected checksum of packet
         */
        detail.CHECKSUM = intToHex(FMI.substr(FMI.length - 6, 2));
        return detail;
    }

    /**
     * Get the packet type by the packet id as text
     * refer to the document '001-00096-00_0F_web.pdf' page 50/56
     * @param {text} packetID
     * @returns {String}
     */
    function getPacketType(packetID) {
        switch (packetID) {
            case '06': //6
                return 'ACK';
                break;
            case '0A'://10
                return 'CMD';
                break;
            case '0E'://14
                return 'TIME';
                break;
            case '15'://21
                return 'NACK';
                break;
            case '26'://38
                return 'ESN';
                break;
            case '33'://51
                return 'PVT';
                break;
            case '87'://135
                return 'LSM'; // Legacy Stop Message
                break;
            case '88'://136
                return 'LTM'; //Legacy Text Message
                break;
            case 'A1'://161
                return 'FMP'; // Fleet Management Packet
                break;
            default:
                return 'UNKNOWN'; // Unknown Packet
                break;
        }
    }

    /**
     * Get a byte value form a given text such as 'A7'
     * @param {text} aByte
     * @returns {Hex}
     */
    function intToHex(aByte) {
        return parseInt(aByte, 16);
    }

    function hexToInt(aHex) {
        return aHex.toString(16);
    }

    function stringToHexString(string) {
        var hexString = '';
        for (var i = 0; i < string.length; i++) {
            var c = string.charCodeAt(i).toString(16);
            if (c.length < 2) {
                c = '0' + c;
            }
            hexString += c;
        }
        return hexString;
    }



    function zeroTailPadding(data, paddinglength) {
        if (data.length % 2 !== 0) {
            data = '0' + data;
        }
        var returnData = data;
        for (var i = data.length / 2; i < paddinglength; i++) {
            returnData += '00';
        }
        return returnData;
    }


    function showDetail(detail) {
        for (var key in detail) {
            console.log(key + ':' + detail[key]);
        }
    }

    /**
     * Put the incmming information into the Postgres database
     * @param {Array} info
     * @returns {undefined}
     */
    function pg_putNewBoxInfo(info) {

        var client = new pg.Client(pgConnectionInfo);
        client.connect(function(error) {
            if (error) {
                client.end();
                console.error(error);
                return error;
            }
            Utils.log('PG: connection successed');
            var sql = "SELECT count(*) as \"total\" FROM \"Boxes\" WHERE \"IMEI\"='" + info.IMEI + "';";
            client.query(sql, function(error, result) {
                if (error) {
                    client.end();
                    console.error(error);
                    return error;
                }

                Utils.log('PG: Duplicate IMEI check...');
                var queryResult = result.rows[0].total;
                Utils.log('PG: result ' + queryResult + ', Duplicated? ' + (queryResult === '1'));
                if (queryResult === '0') {
                    var sql = "INSERT INTO \"Boxes\" (\"IMEI\", \"VER\", \"DRIVER_ID\", \"STATUS\") VALUES ('" + info.IMEI + "', '" + info.VER + "','" + info.DRIVER_ID + "', '-1');";
                    console.log(sql);
                    client.query(sql, function(error) {
                        client.end();
                        if (error) {
                            console.error(error);
                            return error;
                        }
                    });
                    Utils.log('PG: New IMEI Inserted!');
                } else {
                    Utils.log('PG: IMEI already Registered Updating the Driver ID!');
                    var sql = "UPDATE \"Boxes\" SET \"DRIVER_ID\"='" + info.DRIVER_ID + "' WHERE \"IMEI\"='" + info.IMEI + "';";
                    client.query(sql, function() {
                        client.end();
                        if (error) {
                            console.error(error);
                            return error;
                        }
                    });
                    Utils.log('PG: Driver ID Updated!');
                }
            });
        });
    }

    function pg_storeSentMessage(str, callback) {
        var msgID = stringToHexString(str.messageID);
        var mesg = (str.message);
        var client = new pg.Client(pgConnectionInfo);
        client.connect(function(error) {
            if (error) {
                client.end();
                console.error(error);
                return error;
            }
            var sql = "INSERT INTO \"SentMessages\" ( mesg_id, mesg_status, \"mesg_IMEI\", mesg_message) VALUES ('" + msgID + "', 0, '" + info.IMEI + "', '" + (mesg) + "');";
            client.query(sql, function(error, result) {
                client.end();
                if (error) {
                    console.error(error);
                    return error;
                }
                Utils.log('PG: Sent Message Stored');
                if (callback) {
                    callback();
                }
            });

        });
    }


    function pg_updateStoppointStatus(result, callback) {
        console.log(result);
        var sql = "";
//        if (result.STATUS === 104 && false) { // temporary disable
//            sql = "DELETE FROM \"Stoppoints\" WHERE \"s_IMEI\" = '" + info.IMEI + "' AND \"sid\" =  '" + result.ID + "';";
//        } else {
        sql = "UPDATE \"Stoppoints\" SET status = '" + result.STATUS + "', \"listIndex\" = '" + result.INDEX + "' WHERE \"s_IMEI\" = '" + info.IMEI + "' AND \"sid\" =  '" + (result.ID).toLowerCase() + "';";
//        }
        var client = new pg.Client(pgConnectionInfo);
        client.connect(function(error) {
            if (error) {
                client.end();
                console.error(error);
                return error;
            }

            client.query(sql, function(error, result) {
                client.end();
                if (error) {
                    console.error(error);
                    return error;
                }
                Utils.log('PG: Stop Point Status Update');
            });
        });


        if (callback) {
            return callback();
        }
    }


    /**
     * Get the pooling command from database
     * @param {text} IMEI
     * @param {function} callback
     * @returns {undefined}
     */
    function pg_getPoolingCommand(IMEI, callback) {
        var client = new pg.Client(pgConnectionInfo);
        var r = new Array();
        client.connect(function(error) {
            var sql = "SELECT pool_command FROM \"Pool\" WHERE \"pool_IMEI\" = '" + IMEI + "';";
            //console.log(sql);
            client.query(sql, function(error, result) {
                client.end();
                if (error) {
                    console.error(error);
                    return error;
                }

                if (result.rows[0] === undefined) {

                    callback(null);
                    return;
                }
                var queryResult = result.rows[0].pool_command;
                queryResult = queryResult.split(';');
                for (var i = 0; i < queryResult.length; ++i) {
                    r[i] = queryResult[i].split('|');
                }
                if (callback) {
                    callback(r);
                }
                return r;
            });
        });

    }

    function pg_insertMessage(IMEI, dataSet) {
        var sql = "INSERT INTO \"RecvMessages\"(\"Box_IMEI\", \"time\", lat, lon, uniqueid, linkid, message)";
        sql += " VALUES ('" + IMEI + "', '" + dataSet.TIME + "', '" + dataSet.LAT + "', '" + dataSet.LON + "', '" + dataSet.UNIQUEID + "', '" + dataSet.LINKEDID + "', '" + dataSet.MESSAGE + "');";
        console.log(sql);
        var client = new pg.Client(pgConnectionInfo);
        client.connect(function(error) {
            if (error) {
                client.end();
                console.error(error);
                return error;
            }

            client.query(sql, function(error, result) {
                client.end();
                if (error) {
                    console.error(error);
                    return error;
                }
            });

        });

    }

    function pg_removePoolingCommandField(IMEI) {
        var sql = "DELETE FROM \"Pool\" WHERE \"pool_IMEI\"= '" + IMEI + "';";
        var client = new pg.Client(pgConnectionInfo);
        client.connect(function(error) {
            if (error) {
                client.end();
                console.error(error);
                return error;
            }

            client.query(sql, function(error, result) {
                client.end();
                if (error) {
                    console.error(error);
                    return error;
                }
            });
        });
    }

    function pg_getStoppointDetail(sid, callback) {
        var sql = "SELECT *  FROM \"Stoppoints\" WHERE \"sid\"='" + sid + "' AND \"s_IMEI\"='" + info.IMEI + "';";
        var client = new pg.Client(pgConnectionInfo);
        client.connect(function(error) {
            if (error) {
                client.end();
                console.error(error);
                return error;

            }
            client.query(sql, function(error, result) {
                client.end();
                if (error) {
                    console.error(error);
                    return;
                }
                console.log('length ' + result.rows.length);
                //client.end();
                if (callback) {
                    return callback(result.rows[0]);
                }
                return result.rows[0];
            });

        });

    }


    function pg_updateDriverStatus(status) {
        var client = new pg.Client(pgConnectionInfo);
        client.connect(function(error) {
            if (error) {
                client.end();
                console.error(error);
                return error;
            }
            status = parseInt(status, 16);

            var sql = "UPDATE \"Boxes\"  SET \"STATUS\"='" + status + "' WHERE \"IMEI\"='" + info.IMEI + "';";
            console.log(sql);
            client.query(sql, function(error, result) {
                client.end();
                if (error) {
                    console.error(error);
                    return error;
                }
            });

        });

    }

    function pg_updateMessageStatus(result) {
        var sql = "UPDATE \"SentMessages\"   SET  mesg_status='" + result.STATUS + "' WHERE \"mesg_IMEI\"='" + info.IMEI + "' AND mesg_id='" + result.MESG_ID + "' ;";
        var client = new pg.Client(pgConnectionInfo);
        client.connect(function(error) {
            if (error) {
                client.end();
                console.error(error);
                return error;
            }
            client.query(sql, function(error, result) {
                client.end();
                if (error) {
                    console.error(error);
                    return error;
                }
            });

        });

    }


    function initCommandQueue() {
        // Set Driver Status List Items
        commandQueue.enqueue(statusListBuilder(0, 'status 0'));
        commandQueue.enqueue(statusListBuilder(1, 'status 1'));
        commandQueue.enqueue(statusListBuilder(2, 'Status 2'));
        // set initial status to index 0 
        commandQueue.enqueue(defaultStatusBuilder());
        // queue: Requesting Driver ID
        commandQueue.enqueue('10a102101008451003');
        // queue: Requesting Driver Status
        commandQueue.enqueue('10a1022008351003');
    }

    function commandPoolHandler(data) {
        var querystring = require('querystring');
        var str = '';
        switch (data[0]) {
            case 'MESSAGE':
                console.log('Got Message Pool!');
                str = querystring.parse(data[1]);
                pg_storeSentMessage(str, function() {
                    commandQueue.enqueue(messageBuilder(str));
                    //sendFMICommand(messageBuilder(str));
                });

                break;

            case 'STOPPOINT':
                console.log('Got Stoppoint Pool!');
                str = data[1];
                stoppointBuilder(str);
                break;

            case 'CHECKALLPOINTS':
                console.log('Got Check All Stoppoint Pool!');
                console.log(('Checkpoints : ' + data[1]).red);
                break;

            case 'PVT':
                commandQueue.enqueue(PVTFunction(data[1]));
                break;

            default:
                console.error('Unhandle Pooling Command!');
                break;
        }


        return str;


    }

    function PVTFunction(state) {
        if (state === 'ON') {
            return '100a023100c31003';

        } else {
            return '100a023200c21003';
        }
    }

    function defaultStatusBuilder() {
        var result = '';
        result = '03000000' + reversePacket(getTimeFrom1989()) + '000000000000000000';
        result = 'a1' + getPayloadSize(result) + result;
        result = '10' + result + calChecksum(result) + '1003';
        return result;
    }

    /**
     * Convert byyte array to string
     * @param {Byte[]} byteArray
     * @returns {String} result
     */
    function toString(byteArray) {
        var result = '';
        for (var i = 0; i < byteArray.length; i++) {
            result += String.fromCharCode(byteArray[i]);
        }
        return result;
    }

}