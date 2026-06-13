import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:5000';

const donorCredentials = {
  email: __ENV.DONOR_EMAIL || 'hokwirmoki@gmail.com',
  password: __ENV.DONOR_PASSWORD || '1234',
};

const recipientCredentials = {
  email: __ENV.RECIPIENT_EMAIL || 'hokwirmoses@gmail.com',
  password: __ENV.RECIPIENT_PASSWORD || '1234',
};

const adminCredentials = {
  email: __ENV.ADMIN_EMAIL || 'admin@sfs.com',
  password: __ENV.ADMIN_PASSWORD || 'admin123',
};

export const options = {
  vus: Number(__ENV.VUS || 200),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    checks: ['rate>=0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<15000'],
  },
};

function jsonHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return { headers };
}

function postJson(path, body, token) {
  return http.post(`${baseUrl}${path}`, JSON.stringify(body), jsonHeaders(token));
}

function getJson(path, token) {
  return http.get(`${baseUrl}${path}`, jsonHeaders(token));
}

function login(credentials, label) {
  const res = postJson('/api/auth/login', credentials);
  const ok = check(res, {
    [`${label} login`]: (response) => response.status === 200 && Boolean(response.json('token')),
  });

  if (!ok) {
    throw new Error(`${label} login failed. Status: ${res.status}. Body: ${res.body || res.error}`);
  }

  return res.json('token');
}

function reportFailure(label, res) {
  if (res.status >= 400 || res.error) {
    console.error(`${label} failed: status=${res.status} error=${res.error || ''} body=${res.body || ''}`);
  }
}

export function setup() {
  return {
    donorToken: login(donorCredentials, 'donor'),
    recipientToken: login(recipientCredentials, 'recipient'),
    adminToken: login(adminCredentials, 'admin'),
  };
}

export default function (tokens) {
  const marker = `${__VU}-${__ITER}-${Date.now()}`;
  const expiry = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  const discounted = __ITER % 3 === 0;

  const donorProfile = getJson('/api/user/me', tokens.donorToken);
  reportFailure('donor profile', donorProfile);

  const recipientProfile = getJson('/api/user/me', tokens.recipientToken);
  reportFailure('recipient profile', recipientProfile);

  const availableBefore = getJson('/api/recipient/available', tokens.recipientToken);
  reportFailure('available food', availableBefore);

  const postedFood = postJson('/api/food/post', {
    food_type: `System Check Meal ${marker}`,
    quantity: 2,
    expiry_time: expiry,
    location: 'Kampala Central',
    latitude: 0.3476,
    longitude: 32.5825,
    is_discounted: discounted,
    price: discounted ? 5000 : null,
  }, tokens.donorToken);
  reportFailure('post food', postedFood);

  const foodId = postedFood.status === 201 ? postedFood.json('id') : null;

  const donorPosted = getJson('/api/food/posted', tokens.donorToken);
  reportFailure('donor posted food', donorPosted);

  if (foodId) {
    const claim = postJson('/api/recipient/claim', {
      food_id: foodId,
      quantity: 1,
      paymentProvider: 'MTN',
      paymentNumber: '+256700000001',
    }, tokens.recipientToken);
    reportFailure('claim food', claim);

    if (claim.status === 200) {
      const pickup = postJson('/api/recipient/confirm-pickup', {
        food_id: foodId,
      }, tokens.recipientToken);
      reportFailure('confirm pickup', pickup);

      check(pickup, {
        'confirm pickup': (response) => response.status === 200,
      });
    }

    check(claim, {
      'claim food': (response) => response.status === 200,
    });
  }

  const recipientClaims = getJson('/api/recipient/claims', tokens.recipientToken);
  reportFailure('recipient claims', recipientClaims);

  const donorAnalytics = getJson('/api/analytics/donor', tokens.donorToken);
  reportFailure('donor analytics', donorAnalytics);

  const impact = getJson('/api/admin/impact', tokens.adminToken);
  reportFailure('admin impact', impact);

  const financials = getJson('/api/admin/financials', tokens.adminToken);
  reportFailure('admin financials', financials);

  check({
    donorProfile,
    recipientProfile,
    availableBefore,
    postedFood,
    donorPosted,
    recipientClaims,
    donorAnalytics,
    impact,
    financials,
  }, {
    'donor profile': (responses) => responses.donorProfile.status === 200,
    'recipient profile': (responses) => responses.recipientProfile.status === 200,
    'available food': (responses) => responses.availableBefore.status === 200,
    'post food': (responses) => responses.postedFood.status === 201,
    'donor posted food': (responses) => responses.donorPosted.status === 200,
    'recipient claims': (responses) => responses.recipientClaims.status === 200,
    'donor analytics': (responses) => responses.donorAnalytics.status === 200,
    'admin impact': (responses) => responses.impact.status === 200,
    'admin financials': (responses) => responses.financials.status === 200,
  });

  sleep(1);
}
