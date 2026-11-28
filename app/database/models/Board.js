const { DataTypes } = require('sequelize');
const sequelize = require('../connection');

const Board = sequelize.define('Board', {
  name: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
  description: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'boards' });

module.exports = Board;
