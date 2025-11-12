import type { Meta, StoryObj } from "@storybook/react";
import { VueInReact } from "../vue-wrapper";
import TerminalWindow from "./TerminalWindow.vue";

const meta = {
	title: "Components/Common/TerminalWindow",
	component: VueInReact,
	parameters: {
		layout: "padded",
		backgrounds: {
			default: "dark",
		},
	},
	tags: ["autodocs"],
	argTypes: {
		component: {
			table: { disable: true },
		},
	},
} satisfies Meta<typeof VueInReact>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		component: TerminalWindow,
		props: {},
	},
	render: (args) => (
		<VueInReact
			component={{
				template: `
          <TerminalWindow v-bind="props">
            $ npm install @rawkode/academy
            + @rawkode/academy@1.0.0
            added 1 package in 2.341s
            
            $ npm start
            Starting development server...
            Server running at http://localhost:3000
          </TerminalWindow>
        `,
				components: { TerminalWindow },
				setup() {
					return { props: args.props };
				},
			}}
		/>
	),
};

export const CustomTitle: Story = {
	args: {
		component: TerminalWindow,
		props: {
			title: "zsh - ~/projects/my-app",
		},
	},
	render: (args) => (
		<VueInReact
			component={{
				template: `
          <TerminalWindow v-bind="props">
            ~/projects/my-app $ git status
            On branch main
            Your branch is up to date with 'origin/main'.
            
            nothing to commit, working tree clean
          </TerminalWindow>
        `,
				components: { TerminalWindow },
				setup() {
					return { props: args.props };
				},
			}}
		/>
	),
};

export const KubernetesExample: Story = {
	args: {
		component: TerminalWindow,
		props: {
			title: "kubectl",
		},
	},
	render: (args) => (
		<VueInReact
			component={{
				template: `
          <TerminalWindow v-bind="props">
            $ kubectl get pods
            NAME                          READY   STATUS    RESTARTS   AGE
            frontend-5c6db67d8-2jxkl      1/1     Running   0          5m
            frontend-5c6db67d8-9xnzm      1/1     Running   0          5m
            backend-7f8b9c4d5-4qlrt       1/1     Running   0          3m
            database-postgres-0           1/1     Running   0          10m
            
            $ kubectl get services
            NAME         TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)        AGE
            frontend     LoadBalancer   10.96.134.23    203.0.113.10    80:31234/TCP   5m
            backend      ClusterIP      10.96.200.45    &lt;none&gt;          8080/TCP       3m
            database     ClusterIP      10.96.100.12    &lt;none&gt;          5432/TCP       10m
          </TerminalWindow>
        `,
				components: { TerminalWindow },
				setup() {
					return { props: args.props };
				},
			}}
		/>
	),
};

export const DockerExample: Story = {
	args: {
		component: TerminalWindow,
		props: {
			title: "Docker",
		},
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <TerminalWindow title="Docker">
            $ docker build -t myapp:latest .
            [+] Building 45.2s (12/12) FINISHED
             => [internal] load build definition from Dockerfile
             => [internal] load .dockerignore
             => [internal] load metadata for docker.io/library/node:18-alpine
             => [1/7] FROM docker.io/library/node:18-alpine
             => [2/7] WORKDIR /app
             => [3/7] COPY package*.json ./
             => [4/7] RUN npm ci --only=production
             => [5/7] COPY . .
             => [6/7] RUN npm run build
             => [7/7] EXPOSE 3000
             => exporting to image
             => => writing image sha256:7d8a9c4f...
             => => naming to docker.io/library/myapp:latest
            
            $ docker run -p 3000:3000 myapp:latest
            Server started on port 3000
          </TerminalWindow>
        `,
				components: { TerminalWindow },
			}}
		/>
	),
};

export const ErrorOutput: Story = {
	args: {
		component: TerminalWindow,
		props: {
			title: "npm - error",
		},
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <TerminalWindow title="npm - error">
            $ npm run build
            
            > myapp@1.0.0 build
            > tsc && vite build
            
            <span class="text-red-400">src/components/Button.tsx:12:5 - error TS2322: Type 'string' is not assignable to type 'number'.</span>
            
            12     count = "zero";
                   ~~~~~
            
            <span class="text-red-400">Found 1 error in src/components/Button.tsx:12</span>
            
            <span class="text-red-400">ERROR: "build" exited with 1.</span>
          </TerminalWindow>
        `,
				components: { TerminalWindow },
			}}
		/>
	),
};

export const MultipleCommands: Story = {
	args: {
		component: TerminalWindow,
	},
	render: () => (
		<VueInReact
			component={{
				template: `
          <div class="space-y-6">
            <TerminalWindow title="Installation">
              $ curl -fsSL https://raw.githubusercontent.com/rawkode/installer/main/install.sh | bash
              Installing Rawkode Academy CLI...
              Downloading binary... ✓
              Verifying checksum... ✓
              Installing to /usr/local/bin... ✓
              Installation complete!
            </TerminalWindow>
            
            <TerminalWindow title="Configuration">
              $ rawkode config init
              Creating configuration file...
              ? Select your preferred region: <span class="text-green-400">EU West (Ireland)</span>
              ? Enable telemetry? <span class="text-green-400">Yes</span>
              ? Default project name: <span class="text-green-400">my-awesome-project</span>
              
              Configuration saved to ~/.rawkode/config.yaml
            </TerminalWindow>
            
            <TerminalWindow title="First Run">
              $ rawkode create my-first-app
              <span class="text-primary">Creating new application 'my-first-app'...</span>
              ✓ Generated project structure
              ✓ Installed dependencies
              ✓ Initialized git repository
              ✓ Created initial commit
              
              <span class="text-green-400">Success!</span> Created my-first-app at /Users/you/my-first-app
              
              Get started by running:
                cd my-first-app
                rawkode dev
            </TerminalWindow>
          </div>
        `,
				components: { TerminalWindow },
			}}
		/>
	),
};
