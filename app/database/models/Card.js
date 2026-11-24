const { DataTypes } = require('sequelize');
const sequelize = require('../connection');

const Card = sequelize.define('Card', {
  title: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
  description: { type: DataTypes.TEXT, allowNull: true },
  dueDate: { type: DataTypes.DATEONLY, allowNull: true },
  position: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
}, { tableName: 'cards' });

module.exports = Card;
