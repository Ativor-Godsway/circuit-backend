import User from '../models/User.js';
import Post from '../models/Post.js';
import Community from '../models/Community.js';
import Project from '../models/Project.js';
import WorkExperience from '../models/WorkExperience.js';
import Education from '../models/Education.js';
import Application from '../models/Application.js';

// Step weights (must sum to 100)
const STEPS = [
  { key: 'hasAvatar',            pct: 10 },
  { key: 'hasBio',               pct: 15 },
  { key: 'hasInterests',         pct: 10 },
  { key: 'hasCommunity',         pct: 10 },
  { key: 'hasLocation',          pct:  5 },
  { key: 'hasPost',              pct: 10 },
  { key: 'hasSkills',            pct:  5 },
  { key: 'hasWorkOrEdu',         pct:  5 },
  { key: 'isDiscoverable',       pct:  5 },
  { key: 'hasOneProject',        pct: 10 },
  { key: 'hasThreeProjects',     pct:  5 },
  { key: 'hasSixProjects',       pct:  5 },
  { key: 'hasCompletedOppty',    pct:  5 },
];

export const computeProfileCompletion = async (userId) => {
  const [user, postCount, communityCount,
    projects, workCount, eduCount, apps] = await Promise.all([
    User.findById(userId).select('avatar bio interests location skills discoverable').lean(),
    Post.countDocuments({ author: userId }),
    Community.countDocuments({ members: userId }),
    Project.find({ user: userId }).select('_id').lean(),
    WorkExperience.countDocuments({ user: userId }),
    Education.countDocuments({ user: userId }),
    Application.find({ user: userId, status: { $in: ['accepted'] } })
      .populate('opportunity', 'type')
      .lean(),
  ]);

  const projectCount = projects.length;
  const hasCompletedChallOrGig = apps.some(
    (a) => a.opportunity?.type === 'challenge' || a.opportunity?.type === 'gig'
  );

  const flags = {
    hasAvatar:         !!(user?.avatar),
    hasBio:            !!(user?.bio?.trim()),
    hasInterests:      (user?.interests?.length || 0) > 0,
    hasCommunity:      communityCount > 0,
    hasLocation:       !!(user?.location?.trim()),
    hasPost:           postCount > 0,
    hasSkills:         (user?.skills?.length || 0) >= 5,
    hasWorkOrEdu:      (workCount + eduCount) > 0,
    isDiscoverable:    !!(user?.discoverable),
    hasOneProject:     projectCount >= 1,
    hasThreeProjects:  projectCount >= 3,
    hasSixProjects:    projectCount >= 6,
    hasCompletedOppty: hasCompletedChallOrGig,
  };

  const pct = STEPS.reduce((sum, s) => sum + (flags[s.key] ? s.pct : 0), 0);
  return { pct, flags };
};

export const updateProfileCompletion = async (userId) => {
  try {
    const { pct } = await computeProfileCompletion(userId);
    await User.findByIdAndUpdate(userId, { profileCompletion: pct });
    return pct;
  } catch {
    // non-fatal
  }
};
