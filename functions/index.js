const functions = require("firebase-functions");
const app = require("express")();

const FBAuth = require("./util/fbauth");

const cors = require("cors");
app.use(cors());

const { db } = require("./util/admin");

const {
	getAllActivities,
	postActivity,
	getActivity,
	commentOnActivity,
	likeActivity,
	unlikeActivity,
	deleteActivity
} = require("./handlers/activities");
const {
	signup,
	login,
	uploadImage,
	// addUserDetails,
	getAuthenticatedUser,
	getUserDetails,
	markNotificationRead
} = require("./handlers/users");

//activities route
app.get("/activity", getAllActivities);
app.post("/activity", FBAuth, postActivity);
app.get("/activity/:activityId", getActivity);
app.delete("/activity/:activityId", FBAuth, deleteActivity);
app.get("/activity/:activityId/like", FBAuth, likeActivity);
app.get("/activity/:activityId/unlike", FBAuth, unlikeActivity);
app.post("/activity/:activityId/comment", FBAuth, commentOnActivity);

// users route
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.get("/user", FBAuth, getAuthenticatedUser);
app.get("/user/:handle", getUserDetails);
app.post("/notifications", FBAuth, markNotificationRead);
// app.post("/user", FBAuth, addUserDetails);

exports.api = functions.region("europe-west1").https.onRequest(app);

exports.createNotificationOnLike = functions
	.region("europe-west1")
	.firestore.document("likes/{id}")
	.onCreate(snapshot => {
		return db
			.doc(`/activities/${snapshot.data().activityId}`)
			.get()
			.then(doc => {
				if (
					doc.exists &&
					doc.data().userHandle !== snapshot.data().userHandle
				) {
					return db.doc(`/notifications/${snapshot.id}`).set({
						createdAt: new Date(),
						recipient: doc.data().userHandle,
						sender: snapshot.data().userHandle,
						type: "like",
						read: false,
						activityId: doc.id
					});
				}
			})

			.catch(err => {
				console.error(err);
			});
	});

exports.deleteNotificationOnUnlike = functions
	.region("europe-west1")
	.firestore.document("likes/{id}")
	.onDelete(snapshot => {
		return db
			.doc(`/notifications/${snapshot.id}`)
			.delete()
			.catch(err => {
				console.error(err);
			});
	});

exports.createNotificationOnComment = functions
	.region("europe-west1")
	.firestore.document("comments/{id}")
	.onCreate(snapshot => {
		return db
			.doc(`/activities/${snapshot.data().activityId}`)
			.get()
			.then(doc => {
				if (
					doc.exists &&
					doc.data().userHandle !== snapshot.data().userHandle
				) {
					return db.doc(`/notifications/${snapshot.id}`).set({
						createdAt: new Date(),
						recipient: doc.data().userHandle,
						sender: snapshot.data().userHandle,
						type: "comment",
						read: false,
						activityId: doc.id
					});
				}
			})
			.catch(err => {
				console.error(err);
				return;
			});
	});

exports.onUserImageChange = functions
	.region("europe-west1")
	.firestore.document("/users/{userId}")
	.onUpdate(change => {
		if (change.before.data().imageUrl !== change.after.data().imageUrl) {
			const batch = db.batch();
			return db
				.collection("activities")
				.where("userHandle", "==", change.before.data().handle)
				.get()
				.then(data => {
					data.forEach(doc => {
						const activity = db.doc(`/activities/${doc.id}`);
						batch.update(activity, { userImage: change.after.data().imageUrl });
					});
					return batch.commit();
				});
		} else return true;
	});

exports.onActivityDelete = functions
	.region("europe-west1")
	.firestore.document("/activities/{id}")
	.onDelete((snapshot, context) => {
		const activityId = context.params.activityId;
		const batch = db.batch();
		return db
			.collection("comments")
			.where("activityId", "==", activityId)
			.get()
			.then(data => {
				data.forEach(doc => {
					batch.delete(db.doc(`/comments/${doc.id}`));
				});
				return db
					.collection("likes")
					.where("activityId", "==", activityId)
					.get();
			})
			.then(data => {
				data.forEach(doc => {
					batch.delete(db.doc(`/likes/${doc.id}`));
				});
				return db
					.collection("notifications")
					.where("activityId", "==", activityId)
					.get();
			})
			.then(data => {
				data.forEach(doc => {
					batch.delete(db.doc(`/notifications/${doc.id}`));
				});
				return batch.commit();
			})
			.catch(err => console.error(err));
	});
