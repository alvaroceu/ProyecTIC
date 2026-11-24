const { DataTypes } = require('sequelize');
const sequelize = require('../connection');

const Comment = sequelize.define('Comment', {
  text: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: true } },
}, { tableName: 'comments' });

module.exports = Comment;
