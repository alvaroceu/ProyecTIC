const { DataTypes } = require('sequelize');
const sequelize = require('../connection');

const User = sequelize.define('User', {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
    set(value) {
      this.setDataValue('email', typeof value === 'string' ? value.trim().toLowerCase() : value);
    },
  },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
  avatar: { type: DataTypes.STRING, allowNull: true },
}, { tableName: 'users' });

module.exports = User;
