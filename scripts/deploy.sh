#!/bin/bash
set -e

# Production Deployment Script for Multi-Platform Publisher
# This script builds Docker images and deploys the application using docker-compose.prod.yml

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_NAME="mp-publisher"
IMAGE_TAG=${1:-latest}  # Use first argument as tag, default to 'latest'
REGISTRY=${DOCKER_REGISTRY:-""}  # Optional registry prefix

echo -e "${GREEN}=== Multi-Platform Publisher Deployment ===${NC}"
echo "Tag: ${IMAGE_TAG}"
echo "Registry: ${REGISTRY}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose is not installed${NC}"
    exit 1
fi

# Ensure .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found. Copying from .env.example${NC}"
    cp .env.example .env
    echo -e "${RED}IMPORTANT: Edit .env and set required production values before deploying!${NC}"
    exit 1
fi

# Build images
echo -e "${YELLOW}Building Docker images...${NC}"
docker-compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} build

# Tag images (optional push)
if [ -n "$REGISTRY" ]; then
    echo -e "${YELLOW}Tagging images for registry...${NC}"
    docker tag mp-publisher-backend ${REGISTRY}/mp-publisher-backend:${IMAGE_TAG}
    docker tag mp-publisher-frontend ${REGISTRY}/mp-publisher-frontend:${IMAGE_TAG}
fi

# Stop current deployment
echo -e "${YELLOW}Stopping current deployment...${NC}"
docker-compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} down

# Start new deployment
echo -e "${YELLOW}Starting new deployment...${NC}"
docker-compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} up -d

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to become healthy...${NC}"
sleep 10

# Check status
echo -e "${GREEN}Deployment completed!${NC}"
echo ""
echo "Services:"
docker-compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} ps

echo ""
echo "To view logs:"
echo "  docker-compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} logs -f"
echo ""
echo "To run database migrations manually (if needed):"
echo "  docker-compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} exec backend npx prisma migrate deploy"
echo ""
echo "To stop:"
echo "  docker-compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} down"
echo ""
