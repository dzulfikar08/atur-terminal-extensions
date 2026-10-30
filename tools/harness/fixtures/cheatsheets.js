// Sample tldr and man data for the cheatsheets extension, served through atur.exec.
(() => {
  const h = window.__harness;

  const TLDR_NAMES = [
    "awk", "cat", "chmod", "cp", "curl", "cut", "df", "diff", "docker", "docker-compose", "du",
    "find", "git", "git-branch", "git-checkout", "git-commit", "git-log", "git-rebase", "git-stash",
    "grep", "gzip", "head", "jq", "kill", "ln", "ls", "make", "mkdir", "mv", "node", "npm", "ps",
    "rsync", "scp", "sed", "sort", "ssh", "tail", "tar", "tmux", "uniq", "wc", "xargs",
  ];

  const MAN_ROWS = [
    "tar(1) - manipulate tape archives", "tail(1) - display the last part of a file",
    "tac(1) - concatenate and print files in reverse", "tee(1) - pipe fitting",
    "tmux(1) - terminal multiplexer", "touch(1) - change file access and modification times",
    "tr(1) - translate characters", "git(1) - the stupid content tracker", "grep(1) - file pattern searcher",
    "open(2) - open or create a file for reading or writing", "ssh(1) - OpenSSH remote login client",
  ];

  const PAGES = {
    tar: `# tar

> Archiving utility.
> Often combined with a compression method, such as \`gzip\` or \`bzip2\`.
> More information: <https://www.gnu.org/software/tar>.

- Create an archive and write it to a file:

\`tar cf {{path/to/target.tar}} {{path/to/file1 path/to/file2 ...}}\`

- Create a gzipped archive and write it to a file:

\`tar czf {{path/to/target.tar.gz}} {{path/to/file1 path/to/file2 ...}}\`

- Create a gzipped archive from a directory using relative paths:

\`tar czf {{path/to/target.tar.gz}} --directory={{path/to/directory}} .\`

- Extract a (compressed) archive file into the current directory verbosely:

\`tar xvf {{path/to/source.tar[.gz|.bz2|.xz]}}\`

- Extract a (compressed) archive file into the target directory:

\`tar xf {{path/to/source.tar[.gz|.bz2|.xz]}} --directory={{path/to/directory}}\`

- List the contents of a tar file verbosely:

\`tar tvf {{path/to/source.tar}}\`

- Extract files matching a pattern from an archive:

\`tar xf {{path/to/source.tar}} --wildcards {{"*.html"}}\`
`,
    "git-stash": `# git stash

> Stash local Git changes in a temporary area.
> More information: <https://git-scm.com/docs/git-stash>.

- Stash current changes, except new (untracked) files:

\`git stash push -m {{optional_stash_message}}\`

- Stash current changes, including new (untracked) files:

\`git stash -u\`

- Interactively select parts of changed files for stashing:

\`git stash -p\`

- List all stashes (shows stash name, related branch and message):

\`git stash list\`

- Show the changes as a patch between the stash (default is stash@{0}) and the commit back when stash entry was first created:

\`git stash show -p {{stash@{0}}}\`

- Apply a stash (default is the latest, named stash@{0}):

\`git stash apply {{optional_stash_name_or_commit}}\`

- Apply a stash (default is stash@{0}), and remove it from the stash list if applying doesn't cause conflicts:

\`git stash pop {{optional_stash_name}}\`
`,
    docker: `# docker

> Manage Docker containers and images.
> Some subcommands such as \`docker run\` have their own usage documentation.
> More information: <https://docs.docker.com/engine/reference/commandline/cli/>.

- List all docker containers (running and stopped):

\`docker ps --all\`

- Start a container from an image, with a custom name:

\`docker run --name {{container_name}} {{image}}\`

- Start or stop an existing container:

\`docker {{start|stop}} {{container_name}}\`

- Pull an image from a docker registry:

\`docker pull {{image}}\`

- Open a shell inside of an already running container:

\`docker exec --interactive --tty {{container_name}} {{sh}}\`

- Remove a stopped container:

\`docker rm {{container_name}}\`

- Fetch and follow the logs of a container:

\`docker logs --follow {{container_name}}\`
`,
  };

  const ok = (stdout) => ({ stdout, stderr: "", exitCode: 0 });
  const fail = (stderr) => ({ stdout: "", stderr, exitCode: 1 });

  h.set("exec", async (argv) => {
    const args = Array.isArray(argv) ? argv : [];
    const cmd = args[0];
    if (cmd === "pbpaste") return fail("");
    if (cmd === "tldr") {
      if (args.includes("--list") || args.includes("--list-all")) return ok(TLDR_NAMES.join("\n") + "\n");
      if (args.includes("-i")) return ok("Cache: 4,812 pages, updated 2 days ago\n");
      if (args.includes("--raw")) {
        const page = PAGES[args[args.length - 1]];
        return page ? ok(page) : fail("page not found");
      }
      return fail("");
    }
    if (cmd === "apropos") return ok(MAN_ROWS.join("\n") + "\n");
    return fail("");
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test, tries = 100) => { for (let i = 0; i < tries && !test(); i += 1) await sleep(100); };
  window.__cs = {
    sleep, until,
    type: async (text) => {
      await until(() => document.querySelector("input[type=text]"));
      const input = document.querySelector("input[type=text]");
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await until(() => document.querySelector("#results .row"));
    },
  };
})();
