import * as fs from 'fs';
import slugify from "@sindresorhus/slugify";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";
import type { Video } from "./parseVideos.js";

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

const directoryPath = './ai';

fs.readdirSync(directoryPath)
  .filter(file => file.endsWith('.json'))
  .map(async file => {
    const video: Video = JSON.parse(fs.readFileSync(`${directoryPath}/${file}`, 'utf8'));

    // Technologies
    for (const technology of video.technologies) {
      console.log(`Syncing ${technology.name}`);

      const { error } = await supabase.from('technologies').upsert({
        name: technology.name,
        slug: slugify(technology.name, { lowercase: true, decamelize: true }),
        aliases: [],
        description: "",
        tagline: "",
        github_organization: "",
        logo_url: null,
        oss_licensed: technology.repository ? true : false,
        tags: [],
        repository_url: technology.repository,
        documentation_url: technology.documentation,
        website_url: technology.website,
      }, {
        onConflict: 'name',
      });

      if (error !== null) {
        console.debug(technology.name);
        console.debug(error);
      }
    }

    // Shows
    await supabase.from('shows').upsert({
      name: "Rawkode Live",
      slug: slugify("Rawkode Live", { lowercase: true, decamelize: true }),
      description: "",
      visibility: "public",
    }, {
      onConflict: 'name',
    });

    await supabase.from('shows').upsert({
      name: "Klustered",
      slug: slugify("Klustered", { lowercase: true, decamelize: true }),
      description: "",
      visibility: "public",
    }, {
      onConflict: 'name',
    });

    await supabase.from('show_hosts').upsert({
      person_id: "rawkode",
      show_id: "rawkode-live",
    }, {
      onConflict: 'person_id,show_id',
    });

    await supabase.from('show_hosts').upsert({
      person_id: "rawkode",
      show_id: "klustered",
    }, {
      onConflict: 'person_id,show_id',
    });

    // People
    for (const person of video.guests) {
      console.log(`Syncing ${person.name} / ${person.twitter}`);

      const { error } = await supabase.from('people').upsert({
        github_handle: person.github.includes('https://github.com') ? person.github.split('https://github.com/')[1] : person.github,
        name: person.name,
        x_handle: person.twitter,
        website: person.website ? person.website : null,
        biography: person.biography ? person.biography : null,
      }, {
        onConflict: 'github_handle',
      });

      if (error !== null) {
        // Swallow for now
        // console.debug(person.name);
        // console.debug(error);
      }
    }

    // Episodes
    const { error } = await supabase.from('episodes').upsert({
      live: video.scheduledStartTime ? true : false,
      slug: video.slug,
      title: video.title,
      description: video.description,
      duration: video.duration,
      visibility: video.visibility,
      published_at: video.scheduledStartTime === "" ? video.publishedAt : video.scheduledStartTime,
      scheduled_for: video.scheduledStartTime === "" ? null : video.scheduledStartTime,
      links: video.links,
      show_id: video.description.includes('Klustered') ? "klustered" : (video.scheduledStartTime ? "rawkode-live" : null),
    }, {
      onConflict: 'slug',
    });

    if (error) {
      console.debug(video.youtubeId);
      console.debug(error);
    }

    video.guests.map(async (person) => {
      const { error } = await supabase.from('episode_guests').upsert({
        episode_id: video.slug,
        person_id: person.github,
      });

      if (error) {
        console.debug(video.youtubeId);
        console.debug(error);
      }
    });

    video.technologies.map(async (technology) => {
      const { error } = await supabase.from('episode_technologies').upsert({
        episode_id: video.slug,
        technology_id: slugify(technology.name),
      });

      if (error) {
        console.debug(video.youtubeId);
        console.debug(error);
      }
    });

    await supabase.from('episode_channel').upsert({
      channel: "youtube",
      episode_id: video.slug,
      remote_id: video.youtubeId,
    }, {
      onConflict: 'episode_id,channel',
    });

    await supabase.from('episode_statistics').upsert({
      channel: "youtube",
      episode_id: video.slug,
      comment_count: video.commentCount,
      dislike_count: video.dislikeCount,
      favorite_count: video.favoriteCount,
      like_count: video.likeCount,
      view_count: video.viewCount,
    }, {
      onConflict: 'episode_id,channel',
    });
  });
