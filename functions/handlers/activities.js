const { db } = require("../util/admin");

// fetch activity
exports.getAllActivities = (req, res) => {
	db.collection("activities")
		.orderBy("createdAt", "desc")
		.get()
		.then(data => {
			let item = [];
			data.forEach(doc => {
				item.push({
					activityId: doc.id,
					judul: doc.data().judul,
					body: doc.data().body,
					postImage: doc.data().postImage,
					userHandle: doc.data().userHandle,
					createdAt: doc.data().createdAt,
					commentCount: doc.data().commentCount,
					likeCount: doc.data().likeCount,
					userImage: doc.data().userImage
				});
			});
			return res.json(item);
		})
		.catch(error => console.error(error));
};

exports.postActivity = (req, res) => {
	if (req.body.body.trim() === "") {
		return res.status(400).json({ body: "Body must not be empty" });
	}
	const newActivity = {
		body: req.body.body,
		userHandle: req.user.handle,
		userImage: req.user.imageUrl,
		createdAt: new Date().toISOString,
		likeCount: 0,
		commentCount: 0
	};

	db.collection("activities")
		.add(newActivity)
		.then(doc => {
			const resActivity = newActivity;
			resActivity.activityId = doc.id;
			return res.json(resActivity);
		})
		.catch(error => {
			console.error(error);
			return res.status(500).json({ error: "something went wrong" });
		});
};

exports.getActivity = (req, res) => {
	let activityData = {};
	db.doc(`/activities/${req.params.activityId}`)
		.get()
		.then(doc => {
			if (!doc.exists) {
				return res.status(404).json({ error: "Post not found" });
			}
			activityData = doc.data();
			activityData.activityId = doc.id;
			return db
				.collection("comments")
				.orderBy("createdAt", "desc")
				.where("activityId", "==", req.params.activityId)
				.get();
		})
		.then(data => {
			activityData.comments = [];
			data.forEach(doc => {
				activityData.comments.push(doc.data());
			});
			return res.json(activityData);
		})
		.catch(err => {
			console.error(err);
			res.status(500).json({ error: err.code });
		});
};

//comment on activity
exports.commentOnActivity = (req, res) => {
	if (req.body.body.trim() === "")
		return res.status(400).json({ comment: "must not be empty" });

	const newComment = {
		body: req.body.body,
		createdAt: new Date().toISOString(),
		activityId: req.params.activityId,
		userHandle: req.user.handle,
		userImage: req.user.imageUrl
	};

	db.doc(`/activities/${req.params.activityId}`)
		.get()
		.then(doc => {
			if (!doc.exists) {
				return res.status(404).json({ error: "Post not found" });
			}
			return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
		})
		.then(() => {
			return db.collection("comments").add(newComment);
		})
		.then(() => {
			res.json(newComment);
		})
		.catch(err => {
			console.log(err);
			res.status(500).json({ error: "Something went wrong" });
		});
};

// like an activity
exports.likeActivity = (req, res) => {
	const likeDocument = db
		.collection("likes")
		.where("userHandle", "==", req.user.handle)
		.where("activityId", "==", req.params.activityId)
		.limit(1);

	const activityDocument = db.doc(`/activities/${req.params.activityId}`);

	let activityData = {};

	activityDocument
		.get()
		.then(doc => {
			if (doc.exists) {
				activityData = doc.data();
				activityData.activityId = doc.id;
				return likeDocument.get();
			} else {
				return res.status(404).json({ error: "Post not found" });
			}
		})
		.then(data => {
			if (data.empty) {
				return db
					.collection("likes")
					.add({
						activityId: req.params.activityId,
						userHandle: req.user.handle
					})
					.then(() => {
						activityData.likeCount++;
						return activityDocument.update({
							likeCount: activityData.likeCount
						});
					})
					.then(() => {
						return res.json(activityData);
					});
			} else {
				return res.status(400).json({ error: "Post already liked" });
			}
		})
		.catch(err => {
			console.error(err);
			res.status(500).json({ error: err.code });
		});
};

exports.unlikeActivity = (req, res) => {
	const likeDocument = db
		.collection("likes")
		.where("userHandle", "==", req.user.handle)
		.where("activityId", "==", req.params.activityId)
		.limit(1);

	const activityDocument = db.doc(`/activities/${req.params.activityId}`);

	let activityData = {};

	activityDocument
		.get()
		.then(doc => {
			if (doc.exists) {
				activityData = doc.data();
				activityData.activityId = doc.id;
				return likeDocument.get();
			} else {
				return res.status(404).json({ error: "Post not found" });
			}
		})
		.then(data => {
			if (data.empty) {
				return res.status(400).json({ error: "Post not liked" });
			} else {
				return db
					.doc(`/likes/${data.docs[0].id}`)
					.delete()
					.then(() => {
						activityData.likeCount--;
						return activityDocument.update({
							likeCount: activityData.likeCount
						});
					})
					.then(() => {
						return res.json(activityData);
					});
			}
		})
		.catch(err => {
			console.error(err);
			res.status(500).json({ error: err.code });
		});
};

// delete activity
exports.deleteActivity = (req, res) => {
	const document = db.doc(`/activities/${req.params.activityId}`);
	document
		.get()
		.then(doc => {
			if (!doc.exists) {
				return res.status(404).json({ error: " Post not found " });
			}
			if (doc.data().userHandle !== req.user.handle) {
				return res.status(403).json({ error: "Unauthorized" });
			} else {
				return document.delete();
			}
		})
		.then(() => {
			return res.json({ message: "Post deleted successfully" });
		})
		.catch(err => {
			console.error(err);
			return res.status(500).json({ error: err.code });
		});
};
