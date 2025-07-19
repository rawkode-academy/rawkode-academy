package forgepoint

import (
	engage_with_community "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/engage-with-community:activities"
	engage_with_content "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/engage-with-content:activities"
	expand_knowledge "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/expand-knowledge:activities"
	manage_livestreams "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/manage-livestreams:activities"
	manage_content "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/manage-content:activities"
	view_content "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/view-content:activities"
	interact_with_content "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/interact-with-content:activities"
	manage_profile "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/manage-profile:activities"
	manage_marketing_preferences "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/manage-marketing-preferences:activities"
	discover_shows "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/discover-shows:activities"
	discover_technologies "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/discover-technologies:activities"
	interact_with_video "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/interact-with-video:activities"
	search_for_video "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/search-for-video:activities"
	discover_video "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/discover-video:activities"
	discover_podcasts "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/discover-podcasts:activities"
	deepen_expertise "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/deepen-expertise:activities"
	discover_community "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/activities/discover-community:activities"

	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/forgepoint/personas"
)

// Rawkode Academy Story Map
storyMap: {
	product: {
		name:    "Rawkode Academy"
		vision:  "A learning platform for the next generation of cloud native engineers."
		mission: "To provide a high-quality, engaging, and accessible learning experience for all."
	}

	// Activities in order of user journey
	activities: [
		discover_community.discoverCommunity.id,
		deepen_expertise.deepenExpertise.id,
		discover_podcasts.discoverPodcasts.id,
		discover_video.discoverVideo.id,
		search_for_video.searchForVideo.id,
		interact_with_video.interactWithVideo.id,
		discover_shows.discoverShows.id,
		discover_technologies.discoverTechnologies.id,
		manage_profile.manageProfile.id,
		manage_marketing_preferences.manageMarketingPreferences.id,
		engage_with_community.engageWithCommunity.id,
		engage_with_content.engageWithContent.id,
		expand_knowledge.expandKnowledge.id,
		manage_livestreams.manageLivestreams.id,
		manage_content.manageContent.id,
		view_content.viewContent.id,
		interact_with_content.interactWithContent.id,
	]

	// Personas who use Rawkode Academy
	personas: [
		p.host.id,
		p.guest.id,
		p.learner.id,
		p.moderator.id,
		p.contributor.id,
	]
}
