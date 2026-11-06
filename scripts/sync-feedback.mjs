import { synchronizeFeedback } from '../worker/sync.mjs';
export { synchronizeFeedback };
if(import.meta.url===new URL(process.argv[1],'file:').href) {
  synchronizeFeedback({githubToken:process.env.GH_TOKEN,syncToken:process.env.FEEDBACK_SYNC_TOKEN})
    .then(result=>console.log('Feedback sync complete: '+JSON.stringify(result)))
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}
