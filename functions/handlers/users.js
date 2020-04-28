const { admin, db } = require("../util/admin");

const config = require("../util/config");

const firebase = require("firebase");
firebase.initializeApp(config);

const {
	validateSignUpData,
	validateLoginData,
	reduceUserDetails,
} = require("../util/validates");

// signup user
exports.verification = (req, res) => {
	// Download the helper library from https://www.twilio.com/docs/node/install
	// Your Account Sid and Auth Token from twilio.com/console
	// DANGER! This is insecure. See http://twil.io/secure
	const accountSid = "ACa9f104f943075fad91a2f830051a43cf";
	const authToken = "a04c79b029939e07e1d56b6db9f13dcd";
	const client = require("twilio")(accountSid, authToken);

	const verify = {
		phone: req.body.phone,
	};

	client.verify
		.services("VA1634d34bcce52b6ae4dd682b500d2479")
		.verifications.create({ to: verify.phone, channel: "sms" })
		.then((verification) => {
			console.log(verification.status);
			return res.status(201).json({ verification });
		});
};

exports.checkCode = (req, res) => {
	// Download the helper library from https://www.twilio.com/docs/node/install
	// Your Account Sid and Auth Token from twilio.com/console
	// DANGER! This is insecure. See http://twil.io/secure
	const accountSid = "ACa9f104f943075fad91a2f830051a43cf";
	const authToken = "a04c79b029939e07e1d56b6db9f13dcd";
	const client = require("twilio")(accountSid, authToken);

	const check = {
		phone: req.body.phone,
		code: req.body.code,
	};

	client.verify
		.services("VA1634d34bcce52b6ae4dd682b500d2479")
		.verificationChecks.create({
			to: check.phone,
			code: check.code,
		})
		.then((verification_check) => {
			console.log(verification_check.status);
			return res.status(201).json({ verification_check });
		});
};

exports.signup = (req, res) => {
	const newUser = {
		email: req.body.email,
		password: req.body.password,
		confirmPassword: req.body.confirmPassword,
		handle: req.body.handle,
	};

	const { valid, errors } = validateSignupData(newUser);

	if (!valid) return res.status(400).json(errors);

	const noImg = "no-img.png";

	let token, userId;
	db.doc(`/users/${newUser.handle}`)
		.get()
		.then((doc) => {
			if (doc.exists) {
				return res
					.status(400)
					.json({ handle: "this username is already taken" });
			} else {
				return firebase
					.auth()
					.createUserWithEmailAndPassword(newUser.email, newUser.password);
			}
		})
		.then((data) => {
			userId = data.user.uid;
			return data.user.getIdToken();
		})
		.then((idToken) => {
			token = idToken;
			const userCredentials = {
				handle: newUser.handle,
				email: newUser.email,
				createdAt: new Date(),
				//TODO Append token to imageUrl. Work around just add token from image in storage.
				imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
				userId,
			};
			return db.doc(`/users/${newUser.handle}`).set(userCredentials);
		})
		.then(() => {
			return res.status(201).json({ token });
		})
		.catch((err) => {
			console.error(err);
			if (err.code === "auth/email-already-in-use") {
				return res.status(400).json({ email: "Email is already is use" });
			} else {
				return res
					.status(500)
					.json({ general: "Something went wrong, please try again" });
			}
		});
};

//login user
exports.login = (req, res) => {
	const user = {
		email: req.body.email,
		password: req.body.password,
	};

	const { valid, errors } = validateLoginData(user);

	if (!valid) return res.status(400).json(errors);

	firebase
		.auth()
		.signInWithEmailAndPassword(user.email, user.password)
		.then((data) => {
			return data.user.getIdToken();
		})
		.then((token) => {
			return res.json({ token });
		})
		.catch((err) => {
			if (err.code === "auth/wrong-password") {
				return res
					.status(403)
					.json({ general: "Wrong credentials , please try again" });
			} else if (err.code === "auth/invalid-email") {
				return res.status(403).json({ general: "Invalid Email" });
			} else if (err.code === "auth/user-not-found") {
				return res.status(403).json({ general: "Unregistered User" });
			} else {
				return res.status(500).json({ error: err.code });
			}
		});
};

// add user details
exports.addUserDetails = (req, res) => {
	let userDetails = reduceUserDetails(req.body);

	db.doc(`/users/${req.user.handle}`)
		.update(userDetails)
		.then(() => {
			return res.json({ message: "details added successfully" });
		})
		.catch((err) => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		});
};
//get any user details
exports.getUserDetails = (req, res) => {
	let userData = {};
	db.doc(`/users/${req.params.handle}`)
		.get()
		.then((doc) => {
			if (doc.exists) {
				userData.user = doc.data();
				return db
					.collection("activities")
					.where("userHandle", "==", req.params.handle)
					.orderBy("createdAt", "desc")
					.get();
			} else {
				return res.status(404).json({ error: "User not found" });
			}
		})
		.then((data) => {
			userData.activities = [];
			data.forEach((doc) => {
				userData.activities.push({
					body: doc.data().body,
					createdAt: doc.data().createdAt,
					userHandle: doc.data().userHandle,
					userImage: doc.data().userImage,
					likeCount: doc.data().likeCount,
					commentCount: doc.data().commentCount,
					activityId: doc.id,
				});
			});
			return res.json(userData);
		})
		.catch((err) => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		});
};

// get own user details
exports.getAuthenticatedUser = (req, res) => {
	let userData = {};
	db.doc(`/users/${req.user.handle}`)
		.get()
		.then((doc) => {
			if (doc.exists) {
				userData.credentials = doc.data();
				return db
					.collection("likes")
					.where("userHandle", "==", req.user.handle)
					.get();
			}
		})
		.then((data) => {
			userData.likes = [];
			data.forEach((doc) => {
				userData.likes.push(doc.data());
			});
			return db
				.collection("notifications")
				.where("recipient", "==", req.user.handle)
				.orderBy("createdAt", "desc")
				.limit(10)
				.get();
		})
		.then((data) => {
			userData.notifications = [];
			data.forEach((doc) => {
				userData.notifications.push({
					recipient: doc.data().recipient,
					sender: doc.data().sender,
					createdAt: doc.data().createdAt,
					activityId: doc.data().activityId,
					type: doc.data().type,
					type: doc.data().type,
					read: doc.data().read,
					notificationId: doc.id,
				});
			});
			return res.json(userData);
		})
		.catch((err) => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		});
};

// Upload a profile image for user
exports.uploadImage = (req, res) => {
	const BusBoy = require("busboy");
	const path = require("path");
	const os = require("os");
	const fs = require("fs");

	const busboy = new BusBoy({ headers: req.headers });

	let imageFileName;
	let imageToBeUploaded = {};

	busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
		if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
			return res.status(400).json({ error: "Wrong file type submitted" });
		}

		// image.png
		const imageExtension = filename.split(".")[filename.split(".").length - 1];
		imageFileName = `${Math.round(Math.random() * 10000)}.${imageExtension}`;
		const filepath = path.join(os.tmpdir(), imageFileName);
		imageToBeUploaded = { filepath, mimetype };
		file.pipe(fs.createWriteStream(filepath));
	});
	busboy.on("finish", () => {
		admin
			.storage()
			.bucket()
			.upload(imageToBeUploaded.filepath, {
				resumable: false,
				metadata: {
					metadata: {
						contentType: imageToBeUploaded.mimetype,
					},
				},
			})
			.then(() => {
				const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
				return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
			})
			.then(() => {
				return res.json({ message: "Image uploaded successfully" });
			})
			.catch((err) => {
				console.error(err);
				return res.status(500).json({ error: err.code });
			});
	});
	busboy.end(req.rawBody);
};

exports.markNotificationRead = (req, res) => {
	let batch = db.batch();
	req.body.forEach((notificationId) => {
		const notification = db.doc(`/notifications/${notificationId}`);
		batch.update(notification, { read: true });
	});
	batch
		.commit()
		.then(() => {
			return res.json({ message: "Notification marked read" });
		})
		.catch((err) => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		});
};
