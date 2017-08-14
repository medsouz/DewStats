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
	port: {
		type: Sequelize.INTEGER
	},
	password: {
		type: Sequelize.BOOLEAN
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
	eldewritoVersion: {
		type: Sequelize.TEXT
	},
	sprintEnabled: {
		type: Sequelize.BOOLEAN
	},
	assassinationEnabled: {
		type: Sequelize.BOOLEAN
	}

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
			return requestify.get("http://" + item, {timeout: 3000}).catch(function() {/* ignore connection errors */}).then(function(response){
				// If a server fails to respond then return null
				if(!response)
					return null;
				var server = response.getBody();
				if(server.name !== undefined) {
					server.ip = item;
					return server;
				}
			});
		}).catch(function(err) {console.log(err)}).then(function(result) {
			//Remove servers that failed to load
			result = result.filter(function(item) {
				return item !== null;
			});

			var totalPlayers = 0;
			var totalCapacity = 0;
			// Precalculate the totals to add to the scan object
			for(var i in result) {
				var server = result[i];
				totalPlayers += server.numPlayers;
				totalCapacity += server.maxPlayers;
			}

			console.log("Found " + result.length + " servers");
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
							port: server.port,
							password: (server.xnaddr === undefined),
							dedicated: (server.isDedicated !== undefined) ? server.isDedicated : false, //Not implemented in 0.5.1.1
							numPlayers: server.numPlayers,
							maxPlayers: server.maxPlayers,
							eldewritoVersion: server.eldewritoVersion,
							sprintEnabled: server.sprintEnabled,
							assassinationEnabled: server.assassinationEnabled,
							ScanId: scan.id
						});
					});
				}
			})
		});
	}
})