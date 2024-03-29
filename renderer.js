
'use strict';
const { machineId, machineIdSync } = require('node-machine-id');
const mqtt = require('mqtt');
const axios = require('axios');

var appVersion = '1.0.1';
var client = null;
var mqttServer = null;
var mqttUsername = null;
var mqttPassword = null;
var mqttTopicName = machineIdSync({ original: true })
var apiUrl = 'http://127.0.0.1:8189';



function log(message) {
	const txtLog = document.getElementById('txt-log');
	txtLog.value += message + '\n';
}

document.getElementById("app-version").innerHTML = 'iHosConnect: Version: ' + appVersion;
document.getElementById("app-version").addEventListener('click', (event) => {
	event.preventDefault();
	let link = event.target.href;
	require("electron").shell.openExternal(link);
});

document.getElementById('btn-save-setting').addEventListener('click', () => {
	saveSetting();
});

document.getElementById('btn-start').addEventListener('click', () => {

	document.getElementById('btn-start').style.display = 'none';
	document.getElementById('btn-stop').style.display = 'block';
	startWatchFile();
});

document.getElementById('btn-stop').addEventListener('click', () => {
	document.getElementById('btn-stop').style.display = 'none';
	document.getElementById('btn-start').style.display = 'block';
	stopWatchFile();
});

document.getElementById('btn-quit').addEventListener('click', () => {
	require('electron').remote.getCurrentWindow().close();
});

function onClickTab(tabName) {
	const activeTab = document.getElementById(tabName);
	const tabsLink = document.querySelectorAll('.siimple-tabs .siimple-tabs-item');
	tabsLink.forEach((link) => link.classList.remove('siimple-tabs-item--selected'));
	activeTab.classList.add('siimple-tabs-item--selected');

	const tabcontents = document.querySelectorAll('.tabcontents .tabcontent');
	tabcontents.forEach((tab, index) => tab.style.display = 'none');
	const activeContent = document.getElementById(activeTab.dataset.tab);
	activeContent.style.display = 'block';
}


function loadSettingData() {
	mqttServer = localStorage.getItem('mqttServer');
	mqttUsername = localStorage.getItem('mqttUsername');
	mqttPassword = localStorage.getItem('mqttPassword');
	document.getElementById("mqtt-server").value = mqttServer;
	document.getElementById("mqtt-username").value = mqttUsername;
	document.getElementById("mqtt-password").value = mqttPassword;
	document.getElementById("mqtt-topic-name").value = mqttTopicName;

	if (mqttServer && mqttUsername && mqttPassword) {
		document.getElementById('btn-start').style.display = 'none';
		document.getElementById('btn-stop').style.display = 'block';
		startWatchFile();
	}
}

function saveSetting() {
	mqttServer = document.getElementById("mqtt-server").value;
	mqttUsername = document.getElementById("mqtt-username").value;
	mqttPassword = document.getElementById("mqtt-password").value;
	mqttTopicName = document.getElementById("mqtt-topic-name").value;

	localStorage.setItem('mqttServer', mqttServer);
	localStorage.setItem('mqttUsername', mqttUsername);
	localStorage.setItem('mqttPassword', mqttPassword);
	localStorage.setItem('mqttTopicName', mqttTopicName);
	alert('บันทึกเสร็จเรียบร้อย');
}

function initTabs() {
	const tabsLink = document.querySelectorAll('.siimple-tabs .siimple-tabs-item');
	const tabcontents = document.querySelectorAll('.tabcontents .tabcontent');
	tabcontents.forEach((tab, index) => tab.style.display = 'none');
	tabsLink.forEach((link, index) => {
		if (link.classList.contains('siimple-tabs-item--selected')) {
			const activeTab = document.getElementById(link.dataset.tab);
			activeTab.style.display = 'block';
		}
	});

	loadSettingData();
}

function stopWatchFile() {

	try {
		client.disconnect();
	} catch (error) {

	}
}

function startWatchFile() {
	log('MQTT: กำลังเชื่อมต่อ');
	client = mqtt.connect(`mqtt://${mqttServer}`, {
		username: mqttUsername,
		password: mqttPassword,
		protocol: 'mqtt',
		port: 1883
	});

	client.on('connect', () => {
		log('MQTT: กำลังเชื่อมต่อ mqtt สำเร็จ');
		console.log('mqtt is connect');

		client.subscribe('request/read/' + mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				console.log('subscribe request/read/' + mqttTopicName);
			}
		});

		client.subscribe('request/read-card-only/' + mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				console.log('subscribe request/read-card-only/' + mqttTopicName);
			}
		});

		client.subscribe('request/confirm-save/' + mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				console.log('subscribe request/confirm-save/' + mqttTopicName);
			}
		});

		client.subscribe('request/latest-authen-code/' + mqttTopicName, { qos: 2 }, (err) => {
			if (!err) {
				console.log('subscribe request/latest-authen-code/' + mqttTopicName);
			}
		});
	})


	client.on('message', function (topic, message) {
		// message is Buffer
		console.log('on message of ', topic, message.toString());
		const data = JSON.parse(message.toString());
		console.log(data);

		if (topic === 'request/read/' + mqttTopicName) {
			log('ihospital: ขออ่านบัตรประชาชนและตรวจสอบสิทธิ');
			getRead();
		}
		else if (topic === 'request/read-card-only/' + mqttTopicName) {
			getReadCardOnly();
		}
		else if (topic === 'request/confirm-save/' + mqttTopicName) {
			log('ihospital: ขอเลข authen code');
			getReadConfirmSave(data);

		}
		else if (topic === 'request/latest-authen-code/' + mqttTopicName) {
			getLastAuthenCode(data.pid);
		}
	})


	client.on('error', (err) => {
		console.log(err);
		log('MQTT: ไม่สามารถเชื่อมต่อ mqtt ได้');
	})

	client.on('close', function () {
		console.log('mqtt closed');
		log('MQTT: close');
	});

	client.on('offline', function () {
		console.log('offline');
		log('MQTT: offline');
	});

	client.on('reconnect', function () {
		console.log('reconnect');
		log('MQTT: reconnect');
	});
}


function getRead() {
	log('NHSO SmartCard Agent: ติดต่อ สปสช.');
	axios.get(apiUrl + '/api/smartcard/read?readImageFlag=true')
		.then((response) => {
			// handle success
			log('NHSO SmartCard Agent: ตอบกลับมาแล้ว');
			console.log(response);
			client.publish('response/read/' + mqttTopicName, JSON.stringify({
				success: true,
				data: response.data
			}));
			log('NHSO SmartCard Agent: ส่งข้อมูลกลับ ihospital');
		})
		.catch((error) => {
			// handle error
			console.log(error);
			let message = '';
			const errorData = error?.response?.data;
			if (errorData?.status === 418) {
				message = 'ไม่พบเครื่องอ่าน Smart card กรุณาเสียบเครื่องอ่านใหม่อีกครั้ง!!!';
			} else if (errorData?.status === 500) {
				message = 'กรุณาเสียบบัตรประชาชนของผู้ป่วย!!!';
			} else {
				message = errorData?.message || error?.message;
			}

			log('NHSO SmartCard Agent: ' + message);

			client.publish('response/read/' + mqttTopicName, JSON.stringify({
				success: false,
				message: message
			}));
		})
		.finally(() => {
			// always executed
		});
}

function getReadCardOnly() {
	axios.get(apiUrl + '/api/smartcard/read-card-only?readImageFlag=true')
		.then((response) => {
			// handle success
			console.log(response);
			client.publish('response/read-card-only/' + mqttTopicName, 'Hello mqtt')
		})
		.catch((error) => {
			// handle error
			console.log(error);
			client.publish('response/read-card-only/' + mqttTopicName, 'error')
		})
		.finally(() => {
			// always executed
		});
}

function getReadConfirmSave(data) {
	log('NHSO SmartCard Agent: รับข้อมูลและส่งต่อขอ authen code สปสช');
	axios.post(apiUrl + '/api/nhso-service/confirm-save', data)
		.then((response) => {
			log('NHSO SmartCard Agent: Authen สำเร็จ ส่งข้อมูลกลับไปให้ ihospital');
			console.log(response);
			client.publish('response/confirm-save/' + mqttTopicName, JSON.stringify({
				success: true,
				data: response.data
			}))
		})
		.catch((error) => {
			// handle error
			console.log(error);
			const errorData = error?.response?.data;
			log('NHSO SmartCard Agent: Authen ไม่สำเร็จ ส่งข้อมูลกลับไปให้ ihospital');
			client.publish('response/confirm-save/' + mqttTopicName, JSON.stringify({
				success: false,
				message: errorData?.error || error?.message,
				data: errorData?.errors
			}))
		})
		.finally(() => {
			// always executed
		});
}

function getLastAuthenCode(pid) {
	axios.get(apiUrl + '/api/nhso-service/latest-authen-code/' + pid)
		.then((response) => {
			console.log(response);
			client.publish('response/latest-authen-code/' + mqttTopicName, JSON.stringify({
				success: true,
				data: response.data
			}))
		})
		.catch((error) => {
			// handle error
			console.log(error);
			const errorData = error.response.data;
			client.publish('response/latest-authen-code/' + mqttTopicName, JSON.stringify({
				success: false,
				message: errorData.error,
				data: errorData.errors
			}))
		})
		.finally(() => {
			// always executed
		});
}


initTabs();
