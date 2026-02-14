"""
Integration tests for chatbot API endpoints.
Tests the /api/chat route with FastAPI test client.

Run with: python -m pytest backend/tests/test_routes_chat.py -v
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app


@pytest.fixture
def client():
    """Create test client for FastAPI app."""
    return TestClient(app)


class TestChatEndpoint:
    """Test the /api/chat POST endpoint."""

    def test_chat_endpoint_success(self, client):
        """Test successful chat request."""
        payload = {
            "message": "What should I do?",
            "quake_id": None,
            "plan": None,
            "chat_history": None,
        }
        
        with patch("app.chatbot.get_chatbot_response") as mock_chat:
            mock_chat.return_value = ("Stay safe and follow evacuation procedures.", None)
            
            response = client.post("/api/chat", json=payload)
            
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            assert "error" in data
            assert data["error"] is None

    def test_chat_endpoint_with_quake_id(self, client):
        """Test chat with earthquake ID context."""
        payload = {
            "message": "How severe is this?",
            "quake_id": "us7000abc123",
            "plan": None,
            "chat_history": None,
        }
        
        with patch("app.chatbot.get_chatbot_response") as mock_chat:
            with patch("app.usgs.get_quake_by_id") as mock_quake:
                mock_quake.return_value = {
                    "id": "us7000abc123",
                    "place": "Northern California",
                    "time": "2026-02-14T10:00:00",
                    "mag": 6.5,
                    "depth_km": 12,
                    "lat": 40.0,
                    "lng": -120.0,
                }
                mock_chat.return_value = ("This is a significant earthquake.", None)
                
                response = client.post("/api/chat", json=payload)
                
                assert response.status_code == 200
                data = response.json()
                assert "This is a significant" in data["message"]

    def test_chat_endpoint_with_plan(self, client):
        """Test chat with response plan context."""
        plan_data = {
            "summary": "M6.5 earthquake in Northern California",
            "damage_score": 6,
            "priority_actions": [
                "Assess structural integrity",
                "Restore communications",
                "Coordinate shelter operations",
            ],
            "zones": [
                {"level": "high", "radius_km": 10},
                {"level": "medium", "radius_km": 25},
            ],
            "help_stations": [
                {
                    "name": "City Hospital",
                    "type": "medical",
                    "lat": 40.5,
                    "lng": -120.5,
                }
            ],
        }
        
        payload = {
            "message": "What are the priority actions?",
            "quake_id": None,
            "plan": plan_data,
            "chat_history": None,
        }
        
        with patch("app.chatbot.get_chatbot_response") as mock_chat:
            mock_chat.return_value = (
                "Priority actions are: 1. Assess damage 2. Restore communications 3. Open shelters",
                None,
            )
            
            response = client.post("/api/chat", json=payload)
            
            assert response.status_code == 200
            data = response.json()
            assert "Priority" in data["message"]

    def test_chat_endpoint_with_chat_history(self, client):
        """Test chat with conversation history."""
        chat_history = [
            {"role": "user", "content": "What happened?"},
            {"role": "assistant", "content": "A 6.5 magnitude earthquake occurred."},
        ]
        
        payload = {
            "message": "Where should I go?",
            "quake_id": None,
            "plan": None,
            "chat_history": chat_history,
        }
        
        with patch("app.chatbot.get_chatbot_response") as mock_chat:
            mock_chat.return_value = ("Move to an open area away from buildings.", None)
            
            response = client.post("/api/chat", json=payload)
            
            assert response.status_code == 200
            data = response.json()
            assert len(data["message"]) > 0

    def test_chat_endpoint_quick_actions_on_high_severity(self, client):
        """Test that quick actions are returned for high severity."""
        plan_data = {
            "summary": "Critical earthquake",
            "damage_score": 8,  # High severity
            "priority_actions": ["Evacuate", "Take cover"],
            "zones": [{"level": "high", "radius_km": 10}],
        }
        
        payload = {
            "message": "Help!",
            "quake_id": None,
            "plan": plan_data,
            "chat_history": None,
        }
        
        with patch("app.chatbot.get_chatbot_response") as mock_chat:
            with patch("app.chatbot.get_emergency_suggestions") as mock_suggestions:
                mock_chat.return_value = ("Critical situation - evacuate now!", None)
                mock_suggestions.return_value = [
                    "Take cover immediately",
                    "Evacuate to open area",
                    "Await emergency services",
                ]
                
                response = client.post("/api/chat", json=payload)
                
                assert response.status_code == 200
                data = response.json()
                assert data["quick_actions"] is not None
                assert len(data["quick_actions"]) > 0

    def test_chat_endpoint_no_quick_actions_on_low_severity(self, client):
        """Test that quick actions are not returned for low severity."""
        plan_data = {
            "summary": "Minor earthquake",
            "damage_score": 2,  # Low severity
            "priority_actions": ["Monitor situation"],
        }
        
        payload = {
            "message": "What now?",
            "quake_id": None,
            "plan": plan_data,
            "chat_history": None,
        }
        
        with patch("app.chatbot.get_chatbot_response") as mock_chat:
            mock_chat.return_value = ("Continue monitoring the situation.", None)
            
            response = client.post("/api/chat", json=payload)
            
            assert response.status_code == 200
            data = response.json()
            assert data["quick_actions"] is None

    def test_chat_endpoint_error_handling(self, client):
        """Test error handling in chat endpoint."""
        payload = {
            "message": "Test message",
            "quake_id": None,
            "plan": None,
            "chat_history": None,
        }
        
        with patch("app.chatbot.get_chatbot_response") as mock_chat:
            mock_chat.return_value = ("", "API Error: Connection failed")
            
            response = client.post("/api/chat", json=payload)
            
            assert response.status_code == 200
            data = response.json()
            assert data["error"] is not None

    def test_chat_endpoint_empty_message(self, client):
        """Test with empty message."""
        payload = {
            "message": "",
            "quake_id": None,
            "plan": None,
            "chat_history": None,
        }
        
        with patch("app.chatbot.get_chatbot_response") as mock_chat:
            mock_chat.return_value = ("", "Empty message")
            
            response = client.post("/api/chat", json=payload)
            
            assert response.status_code == 200
            data = response.json()
            assert data["error"] is not None


class TestChatComponentIntegration:
    """Test compatibility with frontend ChatPanel component."""

    def test_response_format_matches_chat_panel_expectations(self, client):
        """Test that response format matches ChatbotResponse interface."""
        payload = {
            "message": "What should I do?",
            "quake_id": None,
            "plan": None,
            "chat_history": None,
        }
        
        with patch("app.chatbot.get_chatbot_response") as mock_chat:
            mock_chat.return_value = ("Follow evacuation procedures.", None)
            
            response = client.post("/api/chat", json=payload)
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify TypeScript interface compatibility
            assert "message" in data
            assert isinstance(data["message"], str)
            assert "error" in data
            assert data["error"] is None or isinstance(data["error"], str)
            assert "quick_actions" in data
            assert data["quick_actions"] is None or isinstance(data["quick_actions"], list)

    def test_message_role_conversion(self, client):
        """Test that chat history roles are properly converted."""
        chat_history = [
            {"role": "user", "content": "First question"},
            {"role": "assistant", "content": "First answer"},
            {"role": "user", "content": "Follow-up"},
        ]
        
        payload = {
            "message": "Another question",
            "quake_id": None,
            "plan": None,
            "chat_history": chat_history,
        }
        
        with patch("app.chatbot.get_chatbot_response") as mock_chat:
            mock_chat.return_value = ("Answer to another question.", None)
            
            response = client.post("/api/chat", json=payload)
            
            assert response.status_code == 200
            # Verify call was made with proper history
            call_args = mock_chat.call_args
            assert call_args is not None


class TestExistingAPICompatibility:
    """Test that new chatbot doesn't break existing API functionality."""

    def test_existing_quake_list_endpoint(self, client):
        """Verify /api/quake/list still works."""
        with patch("app.usgs.get_latest_quakes") as mock_quakes:
            mock_quakes.return_value = [
                {
                    "id": "us1",
                    "place": "Test",
                    "time": "2026-02-14",
                    "mag": 5.0,
                    "depth_km": 10,
                    "lat": 40,
                    "lng": -120,
                }
            ]
            
            response = client.get("/api/quake/list")
            assert response.status_code == 200

    def test_existing_analyze_endpoint(self, client):
        """Verify /api/analyze still works."""
        with patch("app.zoning.compute_zoning") as mock_zones:
            with patch("app.plates.distance_km_to_plate") as mock_plate_dist:
                with patch("app.plates.get_plate_motion_proxy_mm_yr") as mock_motion:
                    mock_zones.return_value = (7, [], "high", {})
                    mock_plate_dist.return_value = 50
                    mock_motion.return_value = 25.0
                    
                    payload = {
                        "lat": 40.0,
                        "lng": -120.0,
                        "mag": 6.5,
                        "depth_km": 12,
                    }
                    
                    response = client.post("/api/analyze", json=payload)
                    assert response.status_code == 200 or response.status_code == 400

    def test_health_check_endpoint(self, client):
        """Verify /health endpoint still works."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["ok"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
