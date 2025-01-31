const mongoose = require('mongoose')
const { Schema } = mongoose;

const AdminUserSchema = new Schema({
    email: {
        type: String,
        require: true,
        unique: true
    },
    password: {
        type: String,
        require: true
    }
})


module.exports = mongoose.model("AdminUser",AdminUserSchema);