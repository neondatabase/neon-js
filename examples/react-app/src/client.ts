import { createClient } from '@neondatabase/neon-js';

export const neonClient = createClient({
  auth: {
    url: 'https://ep-broad-wave-ah1vzqk8.neonauth.c-3.us-east-1.aws.neon.tech/neondb/auth',
    allowAnonymous: true,
  },
  dataApi: {
    url: 'https://ep-broad-wave-ah1vzqk8.apirest.c-3.us-east-1.aws.neon.tech/neondb/rest/v1',
  },
});

// // local test
// export const neonClient = createClient({
//   auth: {
//     url: 'https://ep-floral-snow-52713923.neonauth.localtest.me:30443/neondb/auth',
//     allowAnonymous: true,
//   },
//   dataApi: {
//     url: 'https://ep-floral-snow-52713923.apirest.localtest.me:9443/neondb/rest/v1',
//   },
// });
