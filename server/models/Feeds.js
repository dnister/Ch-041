var mongoose = require('mongoose');

var feedSchema = new mongoose.Schema({
	title: String,
	description: String,
	link: String,
	rsslink: String,
	currentSubscriptions: Number,
	totalSubscriptions: Number,
	format: {
		type: String,
		enum: ["RSS", "ATOM"],
		required: true
	}   // format can be eather RSS or ATOM
});

mongoose.model('Feed', feedSchema);