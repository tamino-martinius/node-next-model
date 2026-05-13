import { describe, expect, it } from 'vitest';
import { ModelClass } from '../Model.js';
import { CollectionQuery } from '../query/CollectionQuery.js';
import { InstanceQuery } from '../query/InstanceQuery.js';

class Post extends ModelClass {
  static tableName = 'posts';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
}

class Comment extends ModelClass {
  static tableName = 'comments';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
  static associations = {
    commentablePost: {
      belongsTo: () => Post,
      foreignKey: 'commentableId',
      polymorphic: 'commentable',
    } as any,
  };
}

class PostWithComments extends ModelClass {
  static tableName = 'posts';
  static keys = { id: 1 } as any;
  static order = [] as any;
  static connector = {} as any;
  static associations = {
    comments: {
      hasMany: () => Comment,
      foreignKey: 'commentableId',
      polymorphic: 'commentable',
    } as any,
  };
}

describe('polymorphic association traversal', () => {
  it('belongsTo polymorphic narrows the upstream by typeKey filter', () => {
    const q = (CollectionQuery.fromModel(Comment as any).first() as any).commentablePost;
    expect(q).toBeInstanceOf(InstanceQuery);
    // The upstream (Comment) should be filtered by commentableType = 'posts'.
    const upstreamFilter = (q.state.parent?.upstream.state.filter ?? {}) as any;
    expect(upstreamFilter).toMatchObject({ commentableType: 'posts' });
  });

  it('hasMany polymorphic adds typeKey filter to the leaf filter', () => {
    const q = (CollectionQuery.fromModel(PostWithComments as any).first() as any).comments;
    expect(q).toBeInstanceOf(CollectionQuery);
    const leafFilter = q.state.filter ?? {};
    expect(leafFilter).toMatchObject({ commentableType: 'posts' });
  });

  it('hasOne polymorphic adds typeKey filter to the leaf filter', () => {
    class PostWithFeaturedComment extends ModelClass {
      static tableName = 'posts';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = {} as any;
      static associations = {
        featuredComment: {
          hasOne: () => Comment,
          foreignKey: 'commentableId',
          polymorphic: 'commentable',
        } as any,
      };
    }
    const q = (CollectionQuery.fromModel(PostWithFeaturedComment as any).first() as any)
      .featuredComment;
    expect(q).toBeInstanceOf(InstanceQuery);
    const leafFilter = q.state.filter ?? {};
    expect(leafFilter).toMatchObject({ commentableType: 'posts' });
  });

  it('explicit typeValue overrides default tableName', () => {
    class CommentWithExplicitType extends ModelClass {
      static tableName = 'comments';
      static keys = { id: 1 } as any;
      static order = [] as any;
      static connector = {} as any;
      static associations = {
        commentableArticle: {
          belongsTo: () => Post,
          foreignKey: 'commentableId',
          polymorphic: 'commentable',
          typeValue: 'articles',
        } as any,
      };
    }
    const q = (CollectionQuery.fromModel(CommentWithExplicitType as any).first() as any)
      .commentableArticle;
    const upstreamFilter = (q.state.parent?.upstream.state.filter ?? {}) as any;
    expect(upstreamFilter).toMatchObject({ commentableType: 'articles' });
  });
});
