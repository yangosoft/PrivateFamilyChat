# Use official Node.js LTS image
#FROM node:18 node:lts-alpine3.23
FROM node:lts-alpine3.23

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Expose port (default 3000, can be overridden)
ARG PORT=3000
ENV PORT=${PORT}
EXPOSE ${PORT}

# Copy the rest of the application (except dist, which will be mounted)
COPY . ./

# Remove local dist folder to avoid conflicts with mount
RUN rm -rf ./dist

# Set dist as a mount point (host will mount it)
VOLUME ["/usr/src/app/dist"]


# Ensure logs directory exists before starting
RUN mkdir -p /usr/src/app/logs

# Start the server
CMD ["npm", "run", "start"]
