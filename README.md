# LearnAndEarn

This file is for outlining the requirements and features of the LearnAndEarn project. 
we are migrating an odoo project for language learners to node.js
This is the yaml file for the postgres server
/Users/thomassee/Docker/containers/mark_learnandearn/docker-compose.yml
we go on using the tables. The used tables like
our_videos
begin typically with "our_" 

The mark_learnandearn directory contains Mark's Learn & Earn - a sophisticated language learning platform built on Odoo 17.0. Here's what's happening:

  Core Purpose

  An interactive German language learning system that uses YouTube videos, AI-powered content generation, and speech recognition to help students learn languages
  through:
  - Video-based lessons with AI-generated summaries
  - Speech practice with pronunciation checking
  - Interactive exercises (cloze tests, comprehension questions)
  - Gamification with points and progress tracking

  Technical Stack

  - Odoo 17.0 with PostgreSQL database
  - Ports: 3012 (HTTP), 8077-8078 (longpolling/gevent), 3143 (PostgreSQL)
  - Custom Docker image: thomasseewald/learnandearn:17.0-complete
  - AI Integration: OpenAI GPT-3.5 and DeepSeek APIs

  Key Features

  1. YouTube Integration: Extracts transcripts and creates learning materials
  2. Speech Recognition: Students record themselves reading text
  3. AI Content Generation: Automatic summaries, questions, and vocabulary extraction
  4. Multi-language Support: German, English, Vietnamese, Arabic, Spanish, French
  5. Teacher-Student Roles: Separate interfaces for educators and learners

  Current State

  This is a test/development instance with:
  - Comprehensive test documentation in the Test/ directory
  - Pre-populated test data and content
  - Active development (recovered files, large filestore)
  - Custom modules in mnt/extra-addons/ including the main _our_seewald_youtube module

  The project represents an advanced educational platform leveraging AI and multimedia for immersive language learning, currently in active testing phase.
