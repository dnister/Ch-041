var multer = require('multer'),
	fs = require('fs'),
	mongoose = require('mongoose'),
	User = mongoose.model('User'),
	storage = multer.diskStorage({ //multers disk storage settings
		destination: function(req, file, cb) {
			cb(null, './dist/uploads/');
		},
		filename: function(req, file, cb) {
			var datetimestamp = Date.now();
			cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1]);
		}
	});

var upload = multer({ //multer settings
	storage: storage
}).single('file');

/** API path that will upload the files */

module.exports.upload = function(req, res) {
	upload(req, res, function(err) {
		if (req.file) {
			var fileName = req.file.filename;
			try {
				fs.unlinkSync('dist/' + req.user.avatar);
			} catch (e) {
				console.log(err);
			}
			req.user.avatar = "uploads/" + fileName;
			req.user.save(function(err, user) {
				res.json({ error_code: 0, err_desc: null });
			});
			if (err) {
				res.json({ error_code: 1, err_desc: err });
				return;
			}
		} else return res.status(500).json("File is wrong");
	});
};

module.exports.changeColorTheme = function(req, res) {
	console.log(req.body.colorTheme);
	req.user.colorTheme = req.body.colorTheme;
	req.user.save(function(err, user) {
		if (err) {         
			res.json({
				error_code: 1,
				err_desc: err
			});         
			return;       
		}           
		console.log(user);
		res.json({
			error_code: 0,
			err_desc: null
		}); 

	});      
};
