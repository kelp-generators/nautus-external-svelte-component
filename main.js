const generator = async (prompts, validationRegExes, about, dir, cmd, mergeScript, removeDefault, chalk, fs) => {
    /*
        DON'T DELETE THIS COMMENT, YOU MIGHT NEED IT LATER

        This function will get run when creating boilerplate code.
        You can use the above defined methods to generate code
        Here's a brief explanation of each:

        prompts: contains various prompt functions to get input frome the use
            {
                async prompt(question, defaultValue = '', validationRegEx = null, canBeEmpty = false, validatorFunction = null) => string // NOTE: The validatorFunction can be async
                async confirm(question) => true|false
                async numeral(question, validatorFunction) => number
                async toggle(question, option1, option2) => option1|option2
                async select(question, [...choices]) => choice
                async multiSelect(question, [...choices], min = 0, max = Infinity) => [...choices]
            }
        validationRegExes: contains various RegExes that are useful when dealing with prompts. As of now:
            {
                identifier: Allows a-z, A-Z, -, _, @, ~ and .
                license: Allows valid SPDX licenses, UNKNOWN and SEE LICENSE IN <file>
                repository: Allows github repos, eg. username/repo
                email: Allows valid emails,
                confirmation: Allows yes, no, y and n
                username: Allows typically valid usernames
                url: Allows urls with optional protocol
                phone: Allows international phone numbers
            }
        about: contains whatever the user specified using nautus me. NOTE: All fields can be empty
            {
                realName,
                githubUsername,
                name,
                gender,
                email
            }
        dir: path to the directory where the project files are saved
        cmd: function that allows you to run commands jsut like in a nautus script
            async cmd(command: string) => [exitCode, stdout]
        mergeScript: function that allows you to merge code into a script. NOTE: Don't include the boilerplate for a script, jsut include what needs to be put in the function
            // scriptName shall not include @ or .js
            mergeScript(scriptName, code) => void
        removeDefault: function that removes the default error from a script
            // scriptName shall not include @ or .js
            removeDefault(scriptName) => void
        chalk: chalk module to help you style your console.log's. See https://www.npmjs.com/package/chalk for more
        fs: like the default fs module, but writeFile and writeFileSync are protected
            and ask user before overwriting existing files.
            NOTE: Usage of require('fs') is prohibited to protect the users data
    */

    const { prompt, confirm, numeral, toggle, select, multiSelect } = prompts
    const { identifier, repository, license } = validationRegExes
    const path = require('path')

    // Do your prompts here
    if (!about.githubUsername) about.githubUsername = await prompt('GitHub Username')
    const pkName = await prompt('Name', '', identifier, false, async (input) => {
        // Check if npm module name is availble
        try {
            const res = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(input)}`)
            if (res.data && res.data.error && res.data.error === 'Not found') {
                return true
            } else {
                console.log(chalk.yellow('A package with this name alread exists!'))
                return false
            }
        } catch {
            return true
        }
    })
    const repo = await prompt('GitHub Repo', `${about.githubUsername}/${pkName}`)
    const pkgJsonData = {
        name: pkName,
        version: '1.0.0',
        description: await prompt('Description'),
        svelte: 'src/index.ts',
        main: 'dist/index.js',
        type: 'module',
        types: 'dist/index.d.ts',
        scripts: {
            build: 'rollup -c',
            prepublishOnly: 'npm run build'
        },
        repository: {
            type: 'git',
            url: `git+https://github.com/${repo}.git`
        },
        devDependencies: {},
        dependencies: {},
        keywords: (await prompt('Keywords (seperated by space)', 'svelte')).split(' '),
        author: `${about.githubUsername} <${about.email}>`,
        license: await prompt('License', 'MIT', license),
        bugs: {
            url: `https://github.com/${repo}/issues`
        },
        homepage: `https://github.com/${repo}#readme`,
        files: [
            'src',
            'dist'
        ]
    }

    // Do your generation here
    fs.ensureDirSync(path.join(process.cwd(), 'src'))
    fs.ensureDirSync(path.join(process.cwd(), 'dist'))
    fs.writeFileSync(path.join(process.cwd(), 'src', 'ExampleComponent.svelte'), `<!-- That's how you define a Component -->`)
    fs.writeFileSync(path.join(process.cwd(), 'src', 'index.ts'), `// This is the entry point of your app
// You can export svelte components from here
import ExampleComponent from './ExampleComponent.svelte'
export {
    ExampleComponent
}
`)
    fs.writeFileSync(path.join(process.cwd(), 'package.json'), JSON.stringify(pkgJsonData, null, 4))
    fs.writeFileSync(path.join(process.cwd(), 'tsconfig.json'), JSON.stringify({
        'extends': '@tsconfig/svelte/tsconfig.json',
        'include': [
            'src/**/*',
            'src/node_modules'
        ],
        'exclude': [
            'node_modules/*',
            '__sapper__/*',
            'public/*'
        ],
        'compilerOptions': {
            'outDir': 'dist'
        },
        'declaration': true,
        'types': [
            'svelte'
        ]
    }, null, 4))
    fs.writeFileSync(path.join(process.cwd(), 'rollup.config.js'), `import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import autoPreprocess from 'svelte-preprocess'
import typescript from '@rollup/plugin-typescript';

export default {
	input: 'src/index.ts',
	output: {
		sourcemap: true,
		format: 'es',
		file: 'dist/index.js'
	},
	plugins: [
		svelte({
			preprocess: autoPreprocess()
		}),
		typescript({
			declaration: true,
			outDir: 'dist',
			types: ['svelte']
		}),
		resolve()
	]
};`)
    const installCmd = 'npm i -D ' +
                       '@rollup/plugin-node-resolve ' +
                       '@rollup/plugin-typescript ' +
                       '@tsconfig/svelte ' + 
                       '@types/node ' +
                       'rollup ' +
                       'rollup-plugin-svelte ' +
                       'svelte ' +
                       'svelte-check ' +
                       'svelte-preprocess ' +
                       'tslib ' +
                       'typescript'
    const [exc] = await cmd(installCmd)
    if (exc !== 0) console.log(chalk.red('Failed to install packages. Make sure to run: ' + chalk.cyan(installCmd)))

    mergeScript('Build', `await spawn('npm', ['run', 'build'])`)
    mergeScript('Release', `

// This will automoatically publish your code to npm

const { path, fs } = modules
const file = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json')))
const { version } = file
const versionArray = version.split('.')
const { releasetype } = global
if (releasetype === 'major') {
    versionArray[0] = (parseInt(versionArray[0]) + 1).toString()
    versionArray[1] = '0'
    versionArray[2] = '0'
} else if (releasetype === 'minor') {
    versionArray[1] = (parseInt(versionArray[1]) + 1).toString()
    versionArray[2] = '0'
} else {
    versionArray[2] = (parseInt(versionArray[2]) + 1).toString()
}
const newVersion = versionArray.join('.')
file.version = newVersion
fs.writeFileSync(path.join(process.cwd(), 'package.json'), JSON.stringify(file, null, 4))
await spawn('npm', ['publish'])`)

    console.log(chalk.green(`Successfully generated sharable component. Take a look at ${chalk.cyan('./src/index.ts')} to start writing code.`))
    console.log(chalk.green(`To publish your code, use ${chalk.cyan('nautus release')}. This will build your code beforehand!`))
}

module.exports = {
    generator: generator, // This will get run if you use nautus kelp (aka want to create boilerplate in afresh project)
    use: generator, // This will get run if you use nautus use (aka want additional boilerplate or support for a framework / runtime). Make sure that this won't replace important stuff
    commands: () => {
        /*
            If you just want to create boilerplate code, this function is irrelevant for you.
            If you want to create commands anyways, use 'nautus use commands'
            in this project to add command support.
        */
    },
    gitIgnore: `.dccache
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

src/testproject/

# Diagnostic reports (https://nodejs.org/api/report.html)
report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Directory for instrumented libs generated by jscoverage/JSCover
lib-cov

# Coverage directory used by tools like istanbul
coverage
*.lcov

# nyc test coverage
.nyc_output

# Grunt intermediate storage (https://gruntjs.com/creating-plugins#storing-task-files)
.grunt

# Bower dependency directory (https://bower.io/)
bower_components

# node-waf configuration
.lock-wscript

# Compiled binary addons (https://nodejs.org/api/addons.html)
build/Release

# Dependency directories
node_modules/
jspm_packages/

# Snowpack dependency directory (https://snowpack.dev/)
web_modules/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional stylelint cache
.stylelintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variable files
.env
.env.development.local
.env.test.local
.env.production.local
.env.local

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# Next.js build output
.next
out

# Nuxt.js build / generate output
.nuxt
dist

# Gatsby files
.cache/
# Comment in the public line in if your project uses Gatsby and not Next.js
# https://nextjs.org/blog/next-9-1#public-directory-support
# public

# vuepress build output
.vuepress/dist

# vuepress v2.x temp and cache directory
.temp
.cache

# Serverless directories
.serverless/

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# Stores VSCode versions used for testing VSCode extensions
.vscode-test

# yarn v2
.yarn/cache
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz
.pnp.*
`
}