/* eslint-disable no-empty */
import needle from 'needle';
import dotenv from 'dotenv-safe';
import { IncomingWebhook } from '@slack/webhook';
import express from 'express';
import redis from 'redis';


dotenv.config();

const token = process.env.TWITTER_BEARER_TOKEN;

const app = express();
const rulesURL = 'https://api.twitter.com/2/tweets/search/stream/rules';
const streamURL = 'https://api.twitter.com/2/tweets/search/stream?tweet.fields=public_metrics&expansions=author_id';

const rules = [
  { value: 'Frontend engineer', tag: 'Frontend' },
  { value: 'Backend engineer', tag: 'Backend' },
  { value: 'Vue developer', tag: 'Frontend' },
  { value: 'Node developer', tag: "engineer" },
  { value: 'Backend developer', tag: 'Backend' },
  { value: 'Full Stack Engineer', tag: "engineer" },
  { value: 'Frontend developer', tag: 'Frontend' },
  { value: 'QA engineer', tag: 'QA' },
  { value: 'quality assurance engineer', tag: 'QA' },
  { value: 'software tester', tag: 'QA' },
  { value: 'automation engineer', tag: 'QA' },
  { value: 'sdet', tag: 'QA' },
  { value: 'manual tester', tag: 'QA' },
  { value: 'Mobile developer', tag: 'Mobile' },
  { value: 'Flutter', tag: 'Mobile' },
  { value: 'Flutter developer', tag: 'Mobile' },
  { value: 'Android developer', tag: 'Mobile' },
];

const slack = (tag) => {
  let env;
  switch (tag) {
    case 'Backend':
      env = process.env.SLACK_INCOMING_WEBHOOK_URL2
      break;
    case 'Frontend':
      env = process.env.SLACK_INCOMING_WEBHOOK_URL4
      break;
    case 'QA':
      env = process.env.SLACK_INCOMING_WEBHOOK_URL3
      break
      case 'Mobile':
        env = process.env.SLACK_INCOMING_WEBHOOK_URL5
        break;
    default:
      env = process.env.SLACK_INCOMING_WEBHOOK_URL
      break;
  }
  return new IncomingWebhook(env);
};

// const slack = new IncomingWebhook(process.env.SLACK_INCOMING_WEBHOOK_URL);

// get stream rules
const getRules = async () => {
  const response = await needle('get', rulesURL, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  return response.body;
};

// set stream rules
const setRules = async () => {
  const data = {
    add: rules,
  };
  const response = await needle('post', rulesURL, data, {
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return response.body;
};

// delete stream rules
const deleteRules = async (allRules) => {
  if (!Array.isArray(allRules.data)) {
    return null;
  }

  const ids = allRules.data.map((rule) => rule.id);
  const data = {
    delete: {
      ids,
    },
  };
  const response = await needle('post', rulesURL, data, {
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return response.body;
};

const streamTweets = () => {
  const stream = needle.get(streamURL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  stream.on('data', async (data) => {
    try {
      const json = JSON.parse(data);
      if (json) {
        const { includes: { users }, data: { id, text,  public_metrics: { retweet_count } }, matching_rules } = json;
        const { tag } = matching_rules[0]
        const { name, username } = users[0];
        const keyWord = ["hiring", "job", 'jobs', 'vacancies', 'are looking', 'looking for', 'remote', 'recruiting', 'interested in', 'working in']
        const jobs = keyWord.map((el) => {
          return text.toLowerCase().includes(el)
        })
        const isJob = jobs.includes(true) ? 'true' : 'false'
        // const isRetweet = text.includes('RT @')
        if (isJob === 'true' && retweet_count === 0 ) {
          await slack(tag).send(
            {
              "username": "tweetbot",
              "text": `${text}`,
              "icon_emoji": ":moneybag:",
              "attachments": [
                {
                  "color": "#2eb886",
                  "fields": [
                    {
                      "title": "Environment",
                      "value": "Engineering",
                      "short": true
                    },
                    {
                      "title": "Job",
                      "value": isJob,
                      "short": true
                    },
                    {
                      "title": "Tweet by ",
                      "value": `${name}@${username}`,
                      "short": false
                    }
                  ],
                  "actions": [
                    {
                      "type": "button",
                      "text": "Open Tweet",
                      "style": "primary",
                      "url": `https://mobile.twitter.com/user/status/${id}`
                    },
                  ]
                }
              ]
            }
          );
        }
      }
    } catch (error) { }
  });
};

const port = process.env.PORT || 3000
app.listen(port, () => {
  (async () => {
    let currentRules;
    try {
      // get all stream rules
      currentRules = await getRules();

      // delete all stream rules
      await deleteRules(currentRules);

      // set  rules base on rules array
      await setRules();
    } catch (error) {
      console.log(error);
      process.exit(1);
    }
    streamTweets();
  })();
})