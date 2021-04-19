import express from 'express';
import exphbs from 'express-handlebars';
import chokidar from 'chokidar';

import { getRepository, getLocalBranches } from './git-utils';

async function main() {
  const app = express();
  const repo = await getRepository();

  const viewInstance = exphbs.create({ extname: 'hbs' });

  app.engine('hbs', viewInstance.engine);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'hbs');

  app.get('/', function (req, res) {
    res.render('index');
  });

  app.get('/branches', async function (req, res) {
    const branches = await getLocalBranches(repo);
    const branchNames = branches.map((branch) => branch.name());

    res.render('branches', { branches: branchNames });
  });

  app.get('/branches/sse', async function (req, res) {
    res.set({
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
    });
    res.flushHeaders();

    // Tell the client to retry every 10 seconds if connectivity is lost
    res.write('retry: 10000\n\n');

    chokidar
      .watch(process.cwd() + '/.git/refs/heads', { ignoreInitial: true })
      .on('all', async () => {
        try {
          const branches = await getLocalBranches(repo);
          const branchNames = branches.map((branch) => branch.name());
          const template = await viewInstance.render(
            __dirname + '/views/branches-sse.hbs',
            { branches: branchNames },
          );
          const line = template.replaceAll('\n', '');
          res.write(`data: ${line}\n\n`);
        } catch (e) {
          console.error(e.message);
        }
      });
  });

  const PORT = 8080;

  app.listen(PORT, () => console.log(`Listening on port ${PORT}...`));
}

main();
