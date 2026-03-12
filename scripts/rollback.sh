#!/bin/bash
set -e

# Rollback Script for Multi-Platform Publisher
# Rolls back to a previously deployed image tag

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_NAME="mp-publisher"

if [ $# -ne 1 ]; then
    echo -e "${RED}Usage: $0 <image-tag>${NC}"
    echo "Example: $0 v1.0.0-20240310"
    exit 1
fi

ROLLBACK_TAG=$1

echo -e "${GREEN}=== Rolling back to tag: ${ROLLBACK_TAG} ===${NC}"

# Check if images exist locally
if ! docker image inspect mp-publisher-backend:${ROLLBACK_TAG} &> /dev/null; then
    echo -e "${YELLOW}Image mp-publisher-backend:${ROLLBACK_TAG} not found locally.${NC}"
    read -p "Pull from registry? (requires DOCKER_REGISTRY set) [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -z "$DOCKER_REGISTRY" ]; then
            echo -e "${RED}DOCKER_REGISTRY not set. Cannot pull.${NC}"
            exit 1
        fi
        docker pull ${DOCKER_REGISTRY}/mp-publisher-backend:${ROLLBACK_TAG}
        docker tag ${DOCKER_REGISTRY}/mp-publisher-backend:${ROLLBACK_TAG} mp-publisher-backend:${ROLLBACK_TAG}
        docker pull ${DOCKER_REGISTRY}/mp-publisher-frontend:${ROLLBACK_TAG}
        docker tag ${DOCKER_REGISTRY}/mp-publisher-frontend:${ROLLBACK_TAG} mp-publisher-frontend:${ROLLBACK_TAG}
    else
        echo -e "${RED}Aborting. Please ensure image exists.${NC}"
        exit 1
    fi
fi

# Stop current deployment
echo -e "${YELLOW}Stopping current deployment...${NC}"
docker-compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} down

# Start with rolled back images (they are already tagged locally)
echo -e "${YELLOW}Starting rollback deployment...${NC}"
docker-compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} up -d

echo -e "${GREEN}Rollback completed!${NC}"
echo ""
echo "Services:"
docker-compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} ps
echo ""
echo "To view logs: docker-compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} logs -f"
