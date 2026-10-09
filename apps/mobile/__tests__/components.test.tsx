jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-constants", () => ({ expoConfig: { extra: { apiUrl: "https://api.test" } } }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import type { DebateCard } from "@faceoff/shared";
import { DebateCardView } from "../src/components/DebateCardView";
import { Button, Field } from "../src/components/ui";

const card: DebateCard = {
  id: "11111111-1111-4111-8111-111111111111",
  proposition: "Voting should be mandatory",
  status: "live",
  visibility: "public",
  scheduledStart: null,
  liveStartedAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 600000).toISOString(),
  endedAt: null,
  endReason: null,
  community: { slug: "ballot-box", name: "Ballot Box" },
  forSide: { userId: "a", username: "nora", displayName: "Nora A.", avatarUrl: null, isDemo: false },
  againstSide: { userId: "b", username: "hannah", displayName: "Hannah K.", avatarUrl: null, isDemo: false },
  hostId: "a",
  recordingEnabled: false,
  replayStatus: "none",
  stats: { comments: 0, votes: 0, views: 0 },
  isDemo: false,
};

test("debate card shows the proposition, both sides and live status, and opens the room", () => {
  render(<DebateCardView d={card} />);
  expect(screen.getByText("Voting should be mandatory")).toBeTruthy();
  expect(screen.getByText("Nora A.")).toBeTruthy();
  expect(screen.getByText("Hannah K.")).toBeTruthy();
  expect(screen.getByText("Live")).toBeTruthy();
  fireEvent.press(screen.getByRole("button"));
  expect(router.push).toHaveBeenCalledWith(`/d/${card.id}`);
});

test("demo debates are labelled", () => {
  render(<DebateCardView d={{ ...card, isDemo: true, status: "completed" }} />);
  expect(screen.getByText("Demo")).toBeTruthy();
});

test("buttons are accessible and disabled while loading", () => {
  const onPress = jest.fn();
  render(<Button title="Send challenge" onPress={onPress} loading />);
  const b = screen.getByRole("button", { name: "Send challenge" });
  expect(b.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  fireEvent.press(b);
  expect(onPress).not.toHaveBeenCalled();
});

test("fields show validation errors", () => {
  render(<Field label="Proposition" value="" error="Write a clear proposition" />);
  expect(screen.getByText("Write a clear proposition")).toBeTruthy();
  expect(screen.getByLabelText("Proposition")).toBeTruthy();
});
