const mongoose = require('mongoose');

const geoCoordinate = mongoose.Schema({
    id: { type: Number, index: true },
    number: Number,
	geometry: { type: { type: String, default: 'Point' }, coordinates: [Number] },
});

geoCoordinate.index({geometry: '2dsphere'});
geoCoordinate.index({ id: 1, number: 1 }, { unique : true });

const Coordinate = mongoose.model('Coordinate', geoCoordinate);

module.exports = Coordinate;