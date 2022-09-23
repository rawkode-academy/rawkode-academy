FROM node:18 AS build

WORKDIR /app

# Yes, I know I can optimise this
COPY . /app
RUN yarn install
RUN yarn run build:server

FROM node:18

WORKDIR /app

COPY --from=build /app/dist /app
COPY --from=build /app/node_modules /app/node_modules

ENTRYPOINT [ "node" ]
CMD [ "server.js" ]
