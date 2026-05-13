import { describe, expect, it } from 'vitest';

import { defineTable } from '../schema.js';

describe('defineTable', () => {
  it('collects columns and picks the primary key column', () => {
    const def = defineTable('users', (t) => {
      t.integer('id', { primary: true, autoIncrement: true, null: false });
      t.string('name', { null: false });
    });
    expect(def.primaryKey).toBe('id');
    expect(def.columns.map((c) => c.name)).toEqual(['id', 'name']);
  });

  it('adds indexes declared via t.index', () => {
    const def = defineTable('users', (t) => {
      t.integer('id', { primary: true });
      t.string('email');
      t.index('email', { unique: true });
      t.index(['email', 'id'], { name: 'by_email_id' });
    });
    expect(def.indexes).toEqual([
      { columns: ['email'], name: undefined, unique: true },
      { columns: ['email', 'id'], name: 'by_email_id', unique: false },
    ]);
  });

  describe('t.references', () => {
    it('adds an integer column suffixed "Id" and indexes it by default', () => {
      const def = defineTable('posts', (t) => {
        t.integer('id', { primary: true });
        t.references('user');
      });
      expect(def.columns.find((c) => c.name === 'userId')).toMatchObject({
        type: 'integer',
        nullable: false,
      });
      expect(def.indexes).toEqual([{ columns: ['userId'], name: undefined, unique: false }]);
    });

    it('honours an explicit column override', () => {
      const def = defineTable('comments', (t) => {
        t.integer('id', { primary: true });
        t.references('author', { column: 'author_user_id' });
      });
      expect(def.columns.map((c) => c.name)).toContain('author_user_id');
      expect(def.indexes[0].columns).toEqual(['author_user_id']);
    });

    it('skips the index when index: false is passed', () => {
      const def = defineTable('posts', (t) => {
        t.integer('id', { primary: true });
        t.references('user', { index: false });
      });
      expect(def.indexes).toEqual([]);
    });

    it('forwards index options when index is an object', () => {
      const def = defineTable('posts', (t) => {
        t.integer('id', { primary: true });
        t.references('user', { index: { unique: true, name: 'uniq_user' } });
      });
      expect(def.indexes).toEqual([{ columns: ['userId'], name: 'uniq_user', unique: true }]);
    });
  });
});
