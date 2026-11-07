const { execSync } = require('child_process');
const git = '"C:\\Users\\ayube\\AppData\\Local\\Programs\\Git\\cmd\\git.exe"';

try {
  execSync(`${git} add .`, { stdio: 'inherit' });
  execSync(`${git} commit -m "Fix Vercel Serverless Stateless Auth using HMAC tokens and robust admin loading"`, { stdio: 'inherit' });
  execSync(`${git} push origin main`, { stdio: 'inherit' });
  console.log('SUCCESS: Pushed to GitHub!');
} catch (e) {
  console.error('Error during git push:', e.message);
}
