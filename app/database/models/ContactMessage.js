const { DataTypes } = require('sequelize');
const sequelize = require('../connection');

const ContactMessage = sequelize.define('ContactMessage', {
  name: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
  email: { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
  subject: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
  message: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
}, { tableName: 'contact_messages' });

module.exports = ContactMessage;
