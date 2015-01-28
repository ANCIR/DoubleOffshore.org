import os
from setuptools import setup, find_packages

setup(
    name='doubleoffshore',
    version='0.1',
    description="",
    long_description="",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Operating System :: OS Independent",
        "Programming Language :: Python",
    ],
    keywords='',
    author='Dan O\'Huiginn, Rizmari Versfeld, Khadija Sharife, Friedrich Lindenberg',
    author_email='info@investigativecenters.org',
    url='http://investigativecenters.org',
    license='MIT',
    packages=find_packages(exclude=['ez_setup', 'examples', 'tests']),
    namespace_packages=[],
    include_package_data=True,
    zip_safe=False,
    install_requires=[],
    entry_points={
    },
    tests_require=[]
)
