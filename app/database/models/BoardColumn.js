const { DataTypes } = require('sequelize');
const sequelize = require('../connection');

const BoardColumn = sequelize.define('BoardColumn', {
  name: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
  position: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
}, { tableName: 'board_columns' });

module.exports = BoardColumn;
