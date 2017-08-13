var requestify = require("requestify");
var Promise = require("bluebird");
var Sequelize = require("sequelize");

const sequelize = new Sequelize("dewstats", "", "", {
	dialect: "sqlite",
		pool: {
		max: 5,
		min: 0,
		idle: 10000
	},
	storage: __dirname + "/dewstats.db"
});

const Server = sequelize.define('Server', {
	ip: {
		type: Sequelize.TEXT
	},
	serverName: {
		type: Sequelize.TEXT
	},
	hostName: {
		type: Sequelize.TEXT
	},
	dedicated: {
		type: Sequelize.BOOLEAN
	},
	numPlayers: {
		type: Sequelize.INTEGER
	},
	maxPlayers: {
		type: Sequelize.INTEGER
	},

});

const Scan = sequelize.define('Scan', {
	id: {
		type: Sequelize.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	numPlayers: {
		type: Sequelize.INTEGER
	},
	maxPlayers: {
		type: Sequelize.INTEGER
	}
});

Scan.hasMany(Server);

sequelize.sync();

const MASTERSERVER = "http://158.69.166.144:8080/list"

requestify.get(MASTERSERVER).then(function(response) {
	var body = response.getBody();
	if(body.listVersion !== undefined && body.listVersion == "1") {
		var list = body.result.servers;
		return Promise.map(list, function(item, index, length) {
			return requestify.get("http://" + item, {timeout: 3000}).then(function(response){
				var server = response.getBody();
				if(server.name !== undefined) {
					server.ip = item;
					return server;
				}
			});
		}).then(function(result) {
			var totalPlayers = 0;
			var totalCapacity = 0;
			// Precalculate the totals to add to the scan object
			for(var i in result) {
				var server = result[i];

				totalPlayers += server.numPlayers;
				totalCapacity += server.maxPlayers;
			}

			console.log("Total Players: " + totalPlayers);
			console.log("Total Capacity: " + totalCapacity);

			Scan.create({
				numPlayers: totalPlayers,
				maxPlayers: totalCapacity
			}).then(function(scan, err) {
				if(scan && !err) {
					Promise.map(result, function(server, index, length) {
						return Server.create({
							ip: server.ip,
							serverName: server.name,
							hostName: server.hostPlayer,
							dedicated: (server.isDedicated !== undefined) ? server.isDedicated : false, //Not implemented in 0.5.1.1
							numPlayers: server.numPlayers,
							maxPlayers: server.maxPlayers,
							ScanId: scan.id
						});
					});
				}
			})
		});
	}
})