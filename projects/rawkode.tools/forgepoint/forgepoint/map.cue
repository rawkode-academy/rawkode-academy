package forgepoint

import (
	plan_product "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/activities/plan-product:activities"
	author_stories "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/activities/author-stories:activities"
	review_changes "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/activities/review-changes:activities"
	validate_product "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/activities/validate-product:activities"
	visualize_product "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/activities/visualize-product:activities"
	build_forgepoint "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/activities/build-forgepoint:activities"
	p "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.tools/forgepoint/forgepoint/personas"
)

// ForgePoint Story Map
// This file provides an overview of all activities and their relationships

storyMap: {
	product: {
		name: "ForgePoint"
		vision: "Git-based product evolution system using story mapping"
	}
	
	// Activities in order of user journey
	activities: [
		plan_product.planProduct.id,
		author_stories.authorStories.id,
		review_changes.reviewChanges.id,
		validate_product.validateProduct.id,
		visualize_product.visualizeProduct.id,
		build_forgepoint.buildForgepoint.id,
	]
	
	// Personas who use ForgePoint
	personas: [
		p.productOwner.id,
		p.developer.id,
		p.stakeholder.id,
	]
}