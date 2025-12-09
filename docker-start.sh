#!/bin/bash

#===============================================================================
# Maktab Timetable - Docker Development Environment
# A comprehensive script to manage the Docker-based development environment
#===============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="maktab"
CONTAINER_NAME="maktab-dev"
WEB_PORT=5173
API_PORT=4000
COMPOSE_FILE="docker-compose.yml"

#-------------------------------------------------------------------------------
# Helper Functions
#-------------------------------------------------------------------------------

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║           🏫 Maktab Timetable - Docker Manager 🏫             ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    
    log_success "Docker is available: $(docker --version)"
}

check_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        log_error "Docker Compose is not installed."
        exit 1
    fi
    
    log_success "Docker Compose is available"
}

check_ports() {
    local port_in_use=false
    
    if lsof -Pi :$WEB_PORT -sTCP:LISTEN -t &> /dev/null; then
        log_warning "Port $WEB_PORT is already in use"
        port_in_use=true
    fi
    
    if lsof -Pi :$API_PORT -sTCP:LISTEN -t &> /dev/null; then
        log_warning "Port $API_PORT is already in use"
        port_in_use=true
    fi
    
    if [ "$port_in_use" = true ]; then
        echo ""
        read -p "Do you want to stop existing processes on these ports? (y/n): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            stop_port_processes
        else
            log_error "Cannot continue with ports in use"
            exit 1
        fi
    fi
}

stop_port_processes() {
    log_info "Stopping processes on ports $WEB_PORT and $API_PORT..."
    
    # Kill processes on web port
    if lsof -Pi :$WEB_PORT -sTCP:LISTEN -t &> /dev/null; then
        kill $(lsof -Pi :$WEB_PORT -sTCP:LISTEN -t) 2>/dev/null || true
    fi
    
    # Kill processes on API port
    if lsof -Pi :$API_PORT -sTCP:LISTEN -t &> /dev/null; then
        kill $(lsof -Pi :$API_PORT -sTCP:LISTEN -t) 2>/dev/null || true
    fi
    
    sleep 2
    log_success "Ports cleared"
}

wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    local max_attempts=60
    local attempt=0
    
    # Wait for API
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:$API_PORT/api/health > /dev/null 2>&1; then
            log_success "API is ready on port $API_PORT"
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 1
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_warning "API health check timed out (may still be starting)"
    fi
    
    # Wait for Web
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:$WEB_PORT > /dev/null 2>&1; then
            log_success "Web app is ready on port $WEB_PORT"
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 1
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_warning "Web app health check timed out (may still be starting)"
    fi
}

open_browser() {
    local url="http://localhost:$WEB_PORT"
    
    log_info "Opening browser at $url"
    
    if command -v xdg-open &> /dev/null; then
        xdg-open "$url" 2>/dev/null &
    elif command -v open &> /dev/null; then
        open "$url" 2>/dev/null &
    elif command -v start &> /dev/null; then
        start "$url" 2>/dev/null &
    else
        log_info "Please open your browser and navigate to: $url"
    fi
}

#-------------------------------------------------------------------------------
# Main Commands
#-------------------------------------------------------------------------------

cmd_start() {
    print_banner
    log_info "Starting Maktab development environment..."
    
    check_docker
    check_docker_compose
    check_ports
    
    log_info "Building and starting containers..."
    $COMPOSE_CMD up --build -d
    
    echo ""
    wait_for_services
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🎉 Services Started! 🎉                    ║${NC}"
    echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}  📱 Web App:    ${CYAN}http://localhost:$WEB_PORT${NC}                      ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  🔌 API:        ${CYAN}http://localhost:$API_PORT${NC}                      ${GREEN}║${NC}"
    echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}  📋 Logs:       ${YELLOW}./docker-start.sh logs${NC}                       ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  🛑 Stop:       ${YELLOW}./docker-start.sh stop${NC}                       ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  🔄 Restart:    ${YELLOW}./docker-start.sh restart${NC}                    ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    read -p "Open browser now? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open_browser
    fi
}

cmd_stop() {
    print_banner
    log_info "Stopping Maktab development environment..."
    
    check_docker_compose
    $COMPOSE_CMD down
    
    log_success "All services stopped"
}

cmd_restart() {
    cmd_stop
    echo ""
    cmd_start
}

cmd_logs() {
    check_docker_compose
    
    if [ -n "$2" ]; then
        $COMPOSE_CMD logs -f "$2"
    else
        $COMPOSE_CMD logs -f
    fi
}

cmd_status() {
    print_banner
    check_docker_compose
    
    echo -e "${BLUE}Container Status:${NC}"
    $COMPOSE_CMD ps
    
    echo ""
    echo -e "${BLUE}Port Status:${NC}"
    
    if curl -s http://localhost:$WEB_PORT > /dev/null 2>&1; then
        echo -e "  Web ($WEB_PORT):  ${GREEN}● Running${NC}"
    else
        echo -e "  Web ($WEB_PORT):  ${RED}○ Not responding${NC}"
    fi
    
    if curl -s http://localhost:$API_PORT/api/health > /dev/null 2>&1; then
        echo -e "  API ($API_PORT):  ${GREEN}● Running${NC}"
    else
        echo -e "  API ($API_PORT):  ${RED}○ Not responding${NC}"
    fi
}

cmd_shell() {
    check_docker_compose
    log_info "Opening shell in container..."
    docker exec -it $CONTAINER_NAME /bin/bash
}

cmd_rebuild() {
    print_banner
    log_info "Rebuilding containers from scratch..."
    
    check_docker_compose
    
    $COMPOSE_CMD down -v
    $COMPOSE_CMD build --no-cache
    $COMPOSE_CMD up -d
    
    wait_for_services
    log_success "Rebuild complete!"
}

cmd_clean() {
    print_banner
    log_warning "This will remove all containers, volumes, and cached data!"
    read -p "Are you sure? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        check_docker_compose
        
        log_info "Stopping and removing containers..."
        $COMPOSE_CMD down -v --rmi local
        
        log_info "Removing dangling images..."
        docker image prune -f
        
        log_success "Cleanup complete!"
    else
        log_info "Cleanup cancelled"
    fi
}

cmd_db_backup() {
    check_docker_compose
    
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).db"
    log_info "Creating database backup: $backup_file"
    
    docker exec $CONTAINER_NAME cp /app/packages/api/data/timetable.db /tmp/$backup_file 2>/dev/null || \
    docker exec $CONTAINER_NAME cp /app/packages/api/timetable.db /tmp/$backup_file
    
    docker cp $CONTAINER_NAME:/tmp/$backup_file ./$backup_file
    
    log_success "Database backed up to: $backup_file"
}

cmd_db_restore() {
    if [ -z "$2" ]; then
        log_error "Please specify backup file: ./docker-start.sh db:restore <file>"
        exit 1
    fi
    
    if [ ! -f "$2" ]; then
        log_error "Backup file not found: $2"
        exit 1
    fi
    
    check_docker_compose
    
    log_info "Restoring database from: $2"
    
    docker cp "$2" $CONTAINER_NAME:/tmp/restore.db
    docker exec $CONTAINER_NAME cp /tmp/restore.db /app/packages/api/data/timetable.db 2>/dev/null || \
    docker exec $CONTAINER_NAME cp /tmp/restore.db /app/packages/api/timetable.db
    
    log_success "Database restored! Restart the container to apply changes."
}

cmd_help() {
    print_banner
    echo "Usage: ./docker-start.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start       Start the development environment (default)"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  logs        View container logs (use 'logs app' for specific service)"
    echo "  status      Show status of all services"
    echo "  shell       Open a bash shell in the container"
    echo "  rebuild     Rebuild containers from scratch (clears node_modules)"
    echo "  clean       Remove all containers, volumes, and images"
    echo "  db:backup   Backup the database"
    echo "  db:restore  Restore database from backup file"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./docker-start.sh              # Start development environment"
    echo "  ./docker-start.sh logs         # View all logs"
    echo "  ./docker-start.sh shell        # Open container shell"
    echo "  ./docker-start.sh db:backup    # Backup database"
    echo ""
}

#-------------------------------------------------------------------------------
# Main Entry Point
#-------------------------------------------------------------------------------

main() {
    case "${1:-start}" in
        start)
            cmd_start
            ;;
        stop)
            cmd_stop
            ;;
        restart)
            cmd_restart
            ;;
        logs)
            cmd_logs "$@"
            ;;
        status)
            cmd_status
            ;;
        shell)
            cmd_shell
            ;;
        rebuild)
            cmd_rebuild
            ;;
        clean)
            cmd_clean
            ;;
        db:backup)
            cmd_db_backup
            ;;
        db:restore)
            cmd_db_restore "$@"
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            log_error "Unknown command: $1"
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
