var mongoose = require('mongoose');

var houseSchema = mongoose.Schema({
	url: { type: String, unique: true, index: true },
	address: { type: String, index: true },
	square: String,
	year: String,
	floors: String,
	managestartdate: String,
	geometry: { type: { type: String, default: 'Point' }, coordinates: [Number] },
	supportInfo: {
		type: Map,
		of: String
	}
});

houseSchema.index({geometry: '2dsphere'});

var House = mongoose.model('House', houseSchema);

module.exports = House;