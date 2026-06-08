from __future__ import annotations

from langgraph.graph import StateGraph, END

from .state import GraphState


def build_graph():
    g = StateGraph(GraphState)

    # Scaffold nodes. Real router/tool-calling will be added in later todos.
    async def respond(state: GraphState) -> GraphState:
        # Pass-through placeholder.
        return state

    g.add_node("respond", respond)
    g.set_entry_point("respond")
    g.add_edge("respond", END)

    return g.compile()

