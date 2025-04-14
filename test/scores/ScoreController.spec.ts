import { PlatformTest } from '@tsed/common';
import { MongooseModel } from '@tsed/mongoose';
import { TestMongooseContext } from '@tsed/testing-mongoose';
import mongoose from 'mongoose';
import SuperTest from 'supertest';
import { Score } from '../../src/scores/Score';
import { Server } from '../../src/Server';

describe('ScoreController', () => {
  // bootstrap your Server to load all endpoints before run your test
  let request: SuperTest.SuperTest<SuperTest.Test>;
  let ScoreModel: MongooseModel<Score>;

  beforeAll(TestMongooseContext.bootstrap(Server));
  beforeAll(() => {
    request = SuperTest(PlatformTest.callback());
    ScoreModel = PlatformTest.get<MongooseModel<Score>>(Score);
  });
  afterAll(TestMongooseContext.reset);

  describe('GET /api/scores', () => {
    beforeAll(async () => {
      await new ScoreModel({
        forename: 'Player 0',
        score: 0,
      }).save();

      await new ScoreModel({
        forename: 'Player 1',
        session: 'fakesession',
        score: 200,
      }).save();

      await new ScoreModel({
        forename: 'Player 2',
        score: 5,
      }).save();

      await new ScoreModel({
        forename: 'Player 3',
        score: 2000,
      }).save();

      await new ScoreModel({
        forename: 'Player 4',
        score: 1500,
        category: 'hard',
      }).save();
    });

    afterAll(TestMongooseContext.clearDatabase);

    it('should get all scores for the main leaderboard', async () => {
      const { body, status } = await request.get('/api/scores');

      expect(status).toEqual(200);

      expect(body[0].name).toEqual('Player 3');
      expect(body[0].rank).toEqual(1);

      expect(body[1].name).toEqual('Player 1');
      expect(body[1].rank).toEqual(2);

      expect(body[2].name).toEqual('Player 2');
      expect(body[2].rank).toEqual(3);
    });

    it('should get all scores for the hard category', async () => {
      const { body, status } = await request.get('/api/scores?category=hard');

      expect(status).toEqual(200);
      expect(body.length).toEqual(1);

      expect(body[0].name).toEqual('Player 4');
      expect(body[0].rank).toEqual(1);
    });

    it('should get the top 3 scores', async () => {
      const { body, status } = await request.get('/api/scores?limit=2');

      expect(status).toEqual(200);
      expect(body.length).toEqual(2);

      expect(body[0].name).toEqual('Player 3');
      expect(body[0].rank).toEqual(1);

      expect(body[1].name).toEqual('Player 1');
      expect(body[1].rank).toEqual(2);
    });

    it('should skip the first score', async () => {
      const { body, status } = await request.get('/api/scores?skip=1');

      expect(status).toEqual(200);

      expect(body[0].name).toEqual('Player 1');
      expect(body[0].rank).toEqual(2);
    });
  });

  describe('GET /api/scores/me', () => {
    let cookies: string;

    beforeAll(async () => {
      await new ScoreModel({
        forename: 'Player 0',
        score: 0,
      }).save();

      await new ScoreModel({
        forename: 'Player 1',
        score: 200,
      }).save();

      await new ScoreModel({
        forename: 'Player 2',
        score: 5,
      }).save();

      const { header } = await request.post('/api/scores').send({
        forename: 'My score 1',
        score: 1750,
      });

      cookies = header['set-cookie'];

      await request.post('/api/scores').send({
        forename: 'My score 2',
        score: 3,
      }).set('Cookie', cookies);
    });

    afterAll(TestMongooseContext.clearDatabase);

    // Skip due to a github action error
    // TODO: Try to fix it later.
    it.skip('should get only my score', async () => {
      const { body, status } = await request.get('/api/scores/me').set('Cookie', cookies);

      expect(status).toEqual(200);
      expect(body).toMatchObject([{
        forename: 'My score 1',
        score: 1750,
        rank: 1,
      }, {
        forename: 'My score 2',
        score: 3,
        rank: 4,
      }]);
    });
  });

  describe('GET /api/scores/:id', () => {
    let testScore: Score;

    beforeAll(async () => {
      await new ScoreModel({
        forename: 'Player 0',
        score: 0,
      }).save();

      testScore = await new ScoreModel({
        forename: 'Player 1',
        score: 200,
      }).save();

      await new ScoreModel({
        forename: 'Player 2',
        score: 5,
      }).save();
    });

    it('should return a 500 error', async () => {
      const { status } = await request.get('/api/scores/error');

      expect(status).toEqual(500);
    });

    it('should return a 404 error', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const { status } = await request.get(`/api/scores/${fakeId}`);

      expect(status).toEqual(404);
    });

    it('should return the score', async () => {
      // eslint-disable-next-line no-underscore-dangle
      const { status, body } = await request.get(`/api/scores/${testScore._id.toString()}`);

      expect(status).toEqual(200);
      expect(body).toMatchObject({
        forename: 'Player 1',
        score: 200,
        rank: 1,
      });
    });
  });

  describe('POST /api/scores', () => {
    beforeAll(async () => {
      await new ScoreModel({
        forename: 'Player 0',
        score: 0,
      }).save();

      await new ScoreModel({
        forename: 'Player 1',
        score: 200,
      }).save();

      await new ScoreModel({
        forename: 'Player 2',
        score: 5,
      }).save();

      await new ScoreModel({
        forename: 'Player 3',
        score: 2000,
      }).save();

      await new ScoreModel({
        forename: 'Player 4',
        score: 1500,
        category: 'hard',
      }).save();
    });

    afterAll(TestMongooseContext.clearDatabase);

    it('should return an 400 status', async () => {
      const { status } = await request.post('/api/scores').send({
        forename: 'wrong',
      });

      expect(status).toEqual(400);
    });

    it('should add a score', async () => {
      const { body, status } = await request.post('/api/scores').send({
        forename: 'New Player',
        score: 1750,
      });

      expect(status).toEqual(201);

      expect(body).toMatchObject({
        forename: 'New Player',
        score: 1750,
        rank: 2,
      });
    });
  });

  describe('PUT /api/scores/:id', () => {
    let testScore: Score;

    beforeAll(async () => {
      await new ScoreModel({
        forename: 'Player 0',
        score: 0,
      }).save();

      testScore = await new ScoreModel({
        forename: 'Player 1',
        score: 200,
      }).save();

      await new ScoreModel({
        forename: 'Player 2',
        score: 5,
      }).save();
    });

    it('should return a 404 error', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const { status } = await request.put(`/api/scores/${fakeId}`).send({
        forename: 'wrong',
        score: 1000,
      });

      expect(status).toEqual(404);
    });

    it('should update a score', async () => {
      // eslint-disable-next-line no-underscore-dangle
      const { status, body } = await request.put(`/api/scores/${testScore._id.toString()}`).send({
        forename: 'Updated Player 1',
        score: 200,
      });

      expect(status).toEqual(200);

      expect(body).toMatchObject({
        forename: 'Updated Player 1',
        score: 200,
        rank: 1,
      });
    });
  });

  describe('DELETE /api/scores', () => {
    let testScore: Score;

    beforeAll(async () => {
      testScore = await new ScoreModel({
        forename: 'Player 1',
        score: 200,
      }).save();
    });

    afterAll(TestMongooseContext.clearDatabase);

    it('should return a 404 if score does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const { status } = await request.delete(`/api/scores/${fakeId}`);

      expect(status).toEqual(404);
    });

    it('should delete the score', async () => {
      // eslint-disable-next-line no-underscore-dangle
      const { status, body } = await request.delete(`/api/scores/${testScore._id.toString()}`);

      expect(status).toEqual(200);
      expect(body.deletedCount).toEqual(1);
    });
  });
});
