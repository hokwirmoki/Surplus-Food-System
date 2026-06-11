import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 200,
  duration: '30s',
};

export default function () {

  let url = 'http://localhost:5000/api/auth/login';

  let payload = JSON.stringify({
    email: 'hokwirmoki@gmail.com',
    password: '1234'
  });

  let params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  let res = http.post(url, payload, params);

  console.log('STATUS:', res.status);
  console.log('BODY:', res.body);

  check(res, {
    'login success': (r) => r.status === 200,
  });

  sleep(1);
}