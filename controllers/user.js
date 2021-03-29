const User = require("../models/user");
const bcrypjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const awsUploadImage = require('../utils/aws-upload-image');

function createToken(user, SECRET_KEY, expiresIn) {
    const { id, name, email, username } = user;
    const payload = {
        id,
        name,
        email,
        username
    };

    return jwt.sign(payload, SECRET_KEY, { expiresIn });
}

async function register(input) {

    const newUser = input;
    newUser.email = newUser.email.toLowerCase();
    newUser.username = newUser.username.toLowerCase();

    const { email, username, password } = newUser;

    // Revisamos si el email esta en uso
    const foundEmail = await User.findOne({ email });
    if (foundEmail) throw new Error("El email ya esta en uso");

    // Revisamos si el username esta en uso
    const foundUserName = await User.findOne({ username });
    if (foundUserName) throw new Error("El nombre de usuario ya esta en uso");

    // Encriptar
    const salt = await bcrypjs.genSaltSync(10);
    newUser.password = await bcrypjs.hash(password, salt);

    try {

        const user = new User(newUser);
        user.save();
        return user;
    } catch (error) {
        console.log(error);
    }
}

async function login(input) {
    const { email, password } = input;

    const userFound = await User.findOne({ email: email.toLowerCase() });
    if (!userFound) throw new Error("Error en el email o contraseña");

    const passwordSucess = await bcrypjs.compare(password, userFound.password);
    if (!passwordSucess) throw new Error("Error en el email o contraseña");

    return {
        token: createToken(userFound, process.env.SECRET_KEY, "24h")
    };
}

async function getUser(id, username) {
    let user = null;

    if (id) {
        user = await User.findById(id);
    }

    if (username) {
        user = await User.findOne({ username });
    }

    if (!user) {
        throw new Error("El usuario no existe");
    }

    return user;

}

async function updateAvatar(file, ctx) {

    const { id } = ctx.user;
    const { createReadStream, mimetype } = await file;
    const extension = mimetype.split("/")[1];
    const imageName = `avatar/${id}.${extension}`;
    const fileData = createReadStream();

    try {

        const result = await awsUploadImage(fileData, imageName);
        await User.findByIdAndUpdate(id, { avatar: result });
        return {
            status: true,
            urlAvatar: result
        }

    } catch (error) {
        return {
            status: false,
            urlAvatar: null
        }
    }
}

async function deleteAvatar(ctx) {
    
    const { id } = ctx.user;

    try {
        await User.findByIdAndUpdate(id, { avatar: "" });
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}

module.exports = {
    register,
    login,
    getUser,
    updateAvatar,
    deleteAvatar
}