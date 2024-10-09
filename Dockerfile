FROM node:18-alpine as builder

ENV NODE_ENV build

# Set working directory
WORKDIR /home/node

# Copy package.json and yarn.lock files
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies using yarn
RUN yarn install

# Copy all files and change ownership to node
COPY --chown=node:node . .

# Build the application and prune dev dependencies
RUN yarn build \
    && yarn install --production --frozen-lockfile

RUN mkdir -p /home/node/dist/assets && cp -r ./src/assets/* /home/node/dist/assets

FROM node:18-alpine

ENV NODE_ENV production

# Set working directory
WORKDIR /home/node

# Install necessary packages for font rendering
RUN apk add --no-cache fontconfig ttf-freefont

# Set up additional fonts (optional, for specific languages or styles)
# RUN apk add --no-cache ttf-dejavu ttf-droid ttf-freefont ttf-liberation ttf-ubuntu-font-family


# Copy only necessary files from the builder stage
COPY --from=builder --chown=node:node /home/node/package*.json ./
COPY --from=builder --chown=node:node /home/node/yarn.lock ./
COPY --from=builder --chown=node:node /home/node/node_modules/ ./node_modules/
COPY --from=builder --chown=node:node /home/node/dist/ ./dist/
COPY --from=builder --chown=node:node /home/node/dist/assets ./dist/assets/

# Run as node user
USER node

# Start the application
CMD ["node", "dist/app.js"]
