const { DataTypes } = require('sequelize');
const sequelize = require('../connection');

const ROLES = ['admin', 'collaborator', 'guest'];

const Membership = sequelize.define('Membership', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  boardId: { type: DataTypes.INTEGER, allowNull: false },
  role: { type: DataTypes.STRING, allowNull: false, validate: { isIn: [ROLES] } },
}, {
  tableName: 'memberships',
  indexes: [{ unique: true, fields: ['userId', 'boardId'] }],
});

Membership.ROLES = ROLES;

module.exports = Membership;
